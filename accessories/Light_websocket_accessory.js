var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;
const WebSocket = require('ws');
const loggingEnabled = true;

var statusCallbacks = [];
var ws;

var retryInterval = 0;

log('Starting Light Accessory');
connectWebSocket();
registerAccessory();

function connectWebSocket() {
  log("Connecting WebSocket");
  
  if (retryInterval < 30000) {
    retryInterval += 2500;
  }
  
  ws = new WebSocket('ws://TomLight.lan:81');
  ws.on('open', function open() {
      retryInterval = 0;
      ws.ping('', false, true);
  	  log('WebSocket opened');
  });

  ws.on('close', function close(code, reason) {
  	  log('WebSocket closed: ' + reason);
  });

  ws.on('error', function error(error) {
  	  log('WebSocket error: ' + error.toString());
      setTimeout(connectWebSocket, retryInterval);
  });

  ws.on('message', function incoming(data, flags) {
    log("Got status: " + (data == "1" ? "on" : "off"));
    if (statusCallbacks.length > 0) {
      var callback = statusCallbacks[0];
      statusCallbacks.splice(0, 1);
      callback(null, data == "1");
    }
  });
  
  ws.on('pong', function pong() {
    ws.isAlive = true;
    
    setTimeout(function () {
      ws.ping('', false, true);
      ws.isAlive = false;
      
      setTimeout(function () {
        if (ws.isAlive === false) {
          ws._socket.destroy();
          connectWebSocket();
        }
      }, 5000);
    }, 5000);
  });
}

function registerAccessory() {
  
  log("Registering Light");
  
  var LightController = {
    name: "WebSocket Light", //name of accessory
    pincode: "012-34-567",
    username: "FA:3C:ED:5A:1A:1B", // MAC like address used by HomeKit to differentiate accessories.
    manufacturer: "Tom", //manufacturer (optional)
    model: "v1.0", //model (optional)
    serialNumber: "AA1234567", //serial number (optional)
  	
    setPower: function(status, callback) { //set power of accessory
    log("Turning the " + this.name + " " + (status ? "on" : "off"));
  	  ws.send(status ? "1" : "0", function ack(error) {
        if (!error) {
          callback();
        }
      });
    },
  	
    getPower: function(callback) { //get power of accessory
      log("Getting status...");
      statusCallbacks.push(callback);
      ws.send("?", function ack(error) {
        if (error) {
          statusCallbacks.splice(0, 1);
          callback(error, false);
        }
      });
    },
  	
    identify: function(callback) { //identify the accessory
  	  log("Identifying the " + this.name);
      ws.send("i", function ack(error) {
        if (!error) {
          callback();
        }
      });
    }
  }
  
  var lightUUID = uuid.generate('tom:accessories:light' + LightController.name);
  var lightAccessory = exports.accessory = new Accessory(LightController.name, lightUUID);
  lightAccessory.username = LightController.username;
  lightAccessory.pincode = LightController.pincode;

  // set some basic properties (these values are arbitrary and setting them is optional)
  lightAccessory
    .getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, LightController.manufacturer)
      .setCharacteristic(Characteristic.Model, LightController.model)
      .setCharacteristic(Characteristic.SerialNumber, LightController.serialNumber);

  // listen for the "identify" event for this Accessory
  lightAccessory.on('identify', function(paired, callback) {
    LightController.identify(callback);
  });

  // Add the actual Lightbulb Service and listen for change events from iOS.
  // We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
  lightAccessory
    .addService(Service.Lightbulb, LightController.name) // services exposed to the user should have "names" like "Light" for this case
    .getCharacteristic(Characteristic.On)
    .on('set', function(value, callback) {
      LightController.setPower(value, callback);
    })

    .on('get', function(callback) {
      LightController.getPower(callback)
    });
    
    log("Finished");
}

function log(message) {
  if (loggingEnabled){
    console.log(message);    
  }
}