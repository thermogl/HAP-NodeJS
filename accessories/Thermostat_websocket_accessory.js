var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;
const WebSocket = require('ws');
const loggingEnabled = true;

var tempCallbacks = [];
var targetCallbacks = [];
var modeCallbacks = [];
var ws;
var thermostatAccessory;

var retryInterval = 0;

log('Starting Thermostat Accessory');
connectWebSocket();
registerAccessory();

function connectWebSocket() {
	log("Connecting Thermostat WebSocket");
	
	if (retryInterval < 30000) {
		retryInterval += 2500;
	}
	
	ws = new WebSocket('ws://TomThermostat.lan:81');
	ws.on('open', function open() {
			retryInterval = 0;
			ws.ping('', false, true);
		  log('Thermostat WebSocket opened');
	});

	ws.on('close', function close(code, reason) {
		  log('Thermostat WebSocket closed: ' + reason);
	});

	ws.on('error', function error(error) {
		  log('Thermostat WebSocket error: ' + error.toString());
			setTimeout(connectWebSocket, retryInterval);
	});

	ws.on('message', function incoming(data, flags) {
		
		if (data.length > 1) {
			var firstChar = data.substr(0, 1);
			var stringValue = data.substr(1, data.length - 1);
			var intValue = parseInt(stringValue, 10);
			
			if (firstChar == "t" && targetCallbacks.length > 0) {
				log("Got temp: " + intValue.toString());
				var callback = targetCallbacks[0];
				targetCallbacks.splice(0, 1);
				callback(null, intValue);
			}
			else if (firstChar == "m" && modeCallbacks.length > 0) {
				log("Got mode: " + intValue.toString());
				var callback = modeCallbacks[0];
				modeCallbacks.splice(0, 1);
				callback(null, intValue);
			}
			else if (firstChar == "r" && tempCallbacks.length > 0) {
				log("Got reading: " + intValue.toString());
				var callback = tempCallbacks[0];
				tempCallbacks.splice(0, 1);
				callback(null, intValue);
			}
			else if (firstChar == "s") {
				log("Temp changed to " + stringValue);	
				thermostatAccessory
					.getService(Service.Thermostat)
					.setCharacteristic(Characteristic.TargetTemperature, intValue);
			}
			else if (firstChar == "o") {
				log("Mode changed to " + stringValue);
				thermostatAccessory
					.getService(Service.Thermostat)
					.setCharacteristic(Characteristic.TargetHeatingCoolingState, intValue);
			}
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
		
		setTargetTemperature: function(temp, callback) {
			log("Setting " + this.name + "temp to: " + temp);
			ws.send("t" + temp.toString(), function ack(error) {
				if (!error) {
					callback();	
				}
			});	
		},
		
		getTargetTemperature: function(callback) {
			log("Getting target temperature...");
			targetCallbacks.push(callback);
			ws.send("t?", function ack(error) {
				if (error) {
					targetCallbacks.splice(0, 1);
					callback(error, 0);	
				}
			});	
		},
		
		getCurrentTemperature: function(callback) {
			log("Getting current temperature");
			tempCallbacks.push(callback);
			ws.send("r?", function ack(error) {
				if (error) {
					tempCallbacks.splice(0, 1);
					callback(error, 0);	
				}
			});	
		},
		
		setMode: function(mode, callback) {
			log("Setting " + this.name + "mode to: " + mode);
			ws.send("m" + mode.toString(), function ack(error) {
				if (!error) {
					callback();	
				}
			});	
		},
		
		getMode: function(callback) {
			log("Getting mode...");
			modeCallbacks.push(callback);
			ws.send("m?", function ack(error) {
				if (error) {
					modeCallbacks.splice(0, 1);
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
	thermostatAccessory = exports.accessory = new Accessory(ThermostatController.name, thermostatUUID);
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
		ThermostatController.identify(callback);
	});
		
	thermostatAccessory
		.addService(Service.Thermostat, ThermostatController.name)
		.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
		.on('get', function(callback) {
			ThermostatController.getMode(callback);
		});
		
	thermostatAccessory
		.getService(Service.Thermostat)
		.getCharacteristic(Characteristic.TargetHeatingCoolingState)
		.on('get', function(callback) {
			ThermostatController.getMode(callback);
		})
		.on('set', function(value, callback) {
			ThermostatController.setMode(value, callback);
		});
		
		
	thermostatAccessory
		.getService(Service.Thermostat)
		.getCharacteristic(Characteristic.CurrentTemperature)
		.on('get', function(callback) {
			ThermostatController.getCurrentTemperature(callback);
		});
		
	thermostatAccessory
		.getService(Service.Thermostat)
		.getCharacteristic(Characteristic.TargetTemperature)
		.on('get', function(callback) {
			ThermostatController.getTargetTemperature(callback);
		})
		.on('set', function(value, callback) {
			ThermostatController.setTargetTemperature(value, callback);
		});
}

function log(message) {
	if (loggingEnabled){
		console.log(message);    
	}
}