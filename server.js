'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(8080);

var teachersQueue = [];
var learnersQueue = [];

function maybeStart() {
  if (teachersQueue.length > 0 && learnersQueue.length > 0) {
    var teacher = teachersQueue.shift();
    var learner = learnersQueue.shift();
    var socket = teacher[0];
    var room = teacher[1];
    socket.join(room);
    learner[0].join(room);
    socket.emit('joined', room, socket.id);
    io.sockets.in(room).emit('ready', room);
    socket.broadcast.emit('ready', room);
  }
}

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
    socket.broadcast.emit('message', message);
  });

  socket.on('newTeacher', function(room) {
    log('a new teacher is creating a room: ' + room);
    socket.emit('created', room, socket.id);
    teachersQueue.push([socket, room]);
    maybeStart();
  });

  socket.on('newLearner', function () {
    log('a new learner joined: ');
    socket.emit('joined', socket.id);
    learnersQueue.push([socket]);
    maybeStart();
  });
  
  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', function(){
    console.log('received bye');
  });

});
