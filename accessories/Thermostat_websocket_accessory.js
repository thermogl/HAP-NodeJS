var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;
const WebSocket = require('ws');
const loggingEnabled = true;

var statusCallbacks = [];
var ws;

var retryInterval = 0;

log('Starting Thermostat Accessory');
//connectWebSocket();
registerAccessory();

function connectWebSocket() {
	log("Connecting WebSocket");
	
	if (retryInterval < 30000) {
		retryInterval += 2500;
	}
	
	ws = new WebSocket('ws://TomThermostat.lan:81');
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
		log("Got status: " + data);
		if (statusCallbacks.length > 0) {
			var callback = statusCallbacks[0];
			statusCallbacks.splice(0, 1);
			callback(null, data);
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
	
	log("Registering Thermostat");
	
	var ThermostatController = {
		name: "WebSocket Thermostat", //name of accessory
		pincode: "012-34-567",
		username: "FB:1C:EF:5F:1A:1C", // MAC like address used by HomeKit to differentiate accessories.
		manufacturer: "Tom", //manufacturer (optional)
		model: "v1.0", //model (optional)
		serialNumber: "AA1234568", //serial number (optional)
		
		setTemperature: function(temp, callback) {
			log("Setting " + this.name + " to: " + temp);
			ws.send("s" + temp, function ack(error) {
				if (!error) {
					callback();	
				}
			});	
		},
		
		getTemperature: function(callback) {
			log("Getting temperature...");
			ws.send("?", function ack(error) {
				if (error) {
					statusCallbacks.splice(0, 1);
					callback(error, 0);	
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
	
	var thermostatUUID = uuid.generate('tom:accessories:thermostat' + ThermostatController.name);
	var thermostatAccessory = exports.accessory = new Accessory(ThermostatController.name, thermostatUUID);
	thermostatAccessory.username = ThermostatController.username;
	thermostatAccessory.pincode = ThermostatController.pincode;

	// set some basic properties (these values are arbitrary and setting them is optional)
	thermostatAccessory
		.getService(Service.AccessoryInformation)
			.setCharacteristic(Characteristic.Manufacturer, ThermostatController.manufacturer)
			.setCharacteristic(Characteristic.Model, ThermostatController.model)
			.setCharacteristic(Characteristic.SerialNumber, ThermostatController.serialNumber);

	// listen for the "identify" event for this Accessory
	thermostatAccessory.on('identify', function(paired, callback) {
		log("Identifying Thermostat");
		//ThermostatController.identify(callback);
	});
		
	thermostatAccessory
		.addService(Service.Thermostat, ThermostatController.name)
		.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
		.on('get', function(callback) {
			log("Getting CURRENT heating cooling state");
			callback(null, Characteristic.CurrentHeatingCoolingState.OFF);	
		});
		
	thermostatAccessory
		.getService(Service.Thermostat)
		.getCharacteristic(Characteristic.TargetHeatingCoolingState)
		.on('get', function(callback) {
			log("Getting TARGET heating cooling state");
			callback(null, Characteristic.TargetHeatingCoolingState.HEAT);
		})
		.on('set', function(value, callback) {
			log("Setting TARGET heating cooling state to " + value.toString());
			callback();
		});
		
		
	thermostatAccessory
		.getService(Service.Thermostat)
		.getCharacteristic(Characteristic.CurrentTemperature)
		.on('get', function(callback) {
			log("Getting current temp");
			callback(null, 20);
		});
		
	thermostatAccessory
		.getService(Service.Thermostat)
		.getCharacteristic(Characteristic.TargetTemperature)
		.on('get', function(callback) {
			log("Getting TARGET temp");
			callback(null, 20);
		})
		.on('set', function(value, callback) {
			log("Setting TARGET temp to " + value.toString());
			callback();
		});
}

function log(message) {
	if (loggingEnabled){
		console.log(message);    
	}
}