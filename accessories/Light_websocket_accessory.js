var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;
const WebSocket = require('ws');

var callbackArray = [];
var ws;

console.log('Starting Light Accessory');
connectWebSocket();
registerAccessory();

function connectWebSocket() {
  console.log("Connecting WebSocket");
  
  ws = new WebSocket('ws://TomLight.lan:81');
  ws.on('open', function open() {
  	  console.log('WebSocket opened');
  });

  ws.on('close', function close(code, reason) {
  	  console.log('WebSocket closed: ' + reason);
  });

  ws.on('error', function error(error) {
  	  console.log('WebSocket error: ' + error.toString());
  });

  ws.on('message', function incoming(data, flags) {
    console.log("Got status: " + (data == "1" ? "on" : "off"));
    if (callbackArray.length > 0) {
      var callback = callbackArray[0];
      callbackArray.splice(0, 1);
      callback(null, data == "1");
    }
  });
}

function registerAccessory() {
  
  console.log("Registering Accessory");
  
  var LightController = {
    name: "WebSocket Light", //name of accessory
    pincode: "012-34-567",
    username: "FA:3C:ED:5A:1A:1B", // MAC like address used by HomeKit to differentiate accessories.
    manufacturer: "Tom", //manufacturer (optional)
    model: "v1.0", //model (optional)
    serialNumber: "AA1234567", //serial number (optional)
    outputLogs: true, //output logs
  	
    setPower: function(status, callback) { //set power of accessory
  	  if(this.outputLogs) console.log("Turning the '%s' %s", this.name, status ? "on" : "off");
  	  ws.send(status ? "1" : "0", function ack(error) {
        // If error is not defined, the send has been completed, otherwise the error
        // object will indicate what failed.
        if (!error) {
          callback();
        }
      });
    },
  	
    getPower: function(callback) { //get power of accessory
      if(this.outputLogs) console.log("Getting status...");
      callbackArray.push(callback);
      ws.send("?", function ack(error) {
        if (error) {
          callbackArray.splice(0, 1);
          callback(error, false);
        }
      });
    },
  	
    identify: function() { //identify the accessory
  	  if(this.outputLogs) console.log("Identify the '%s'", this.name);
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
    LightController.identify();
    callback();
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
}