'use strict';

var server;
if (process.argv.length > 2) {
  var useHTTPS = true;
  var tls = require('tls');
  var serverOptions = {
    key: fs.readFileSync('privkey1.pem'),
    cert: fs.readFileSync('cert1.pem')
  };
  server = tls;
} else {
  var http = require('http');
  server = http;
}

var os = require('os');
var nodeStatic = require('node-static');
var socketIO = require('socket.io');

var fileServer = new(nodeStatic.Server)();
var app = server.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(8080);

var teachersQueue = [];
var learnersQueue = [];

function findAvailableFrom(queue) {
  while (true) {
    if (queue.length == 0) {
      return null;
    }
    var elem = queue[0];
    if (elem[0].connected) {
      return elem;
    } else {
      queue.shift();
    }
  }
}

function cleanupIn(queue, sock) {
  while (true) {
    if (queue.length == 0) {
      return null;
    }
    var elem = queue[0];
    if (elem[0].connected) {
      return elem;
    } else {
      queue.shift();
    }
  }
}

function maybeStart() {
    var teacher = findAvailableFrom(teachersQueue);
    var learner = findAvailableFrom(learnersQueue);
    if (teacher && learner) {
      teachersQueue.shift();
      learnersQueue.shift();
      var socket = teacher[0];
      var room = teacher[1];
      socket.join(room);
      learner[0].join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready', room);
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

  socket.on('disconnect', function(){
    console.log('disconnected');
  });

  socket.on('reset', function(){
    console.log('reset queues');
    teachersQueue = [];
    learnersQueue = [];
  });
});
