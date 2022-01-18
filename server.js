const express = require("express");
const socket = require("socket.io");
const cors = require("cors");
const app = express();
app.use(cors());

var roomss = [];
var roomCnt = new Map(); //keeps rooms count of players
var myCounter = 0; //keeps incrementing a room

var toBsent = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]; //0-11 need 12 elements

app.use(express.static("public"));

const server = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + server.address().port);
});

var io = socket(server);
io.on("connection", function (socket) {
  console.log("Player Connected...." + socket.id); //Not sending anything back cz by default a connected event is raised at the client... so i'll know

  var myOwnRoom; //a seperate copy of this variable will belong to individual sockets

  socket.on("RoomJoining", function (data) {
    console.log("JoiningRequest from " + data);
    socket.join(data);
    console.log("Server rooms variable:" + socket.rooms);
    //for (const room of socket.rooms) { console.log("===> " + room);} //room only contains its own socketId and the name of the room that this socket connected to
    socket.emit("RoomJoining", "Joined room #" + data);
    myOwnRoom = data; //used incase of sudden disconnection

    //for 2x2's all players to start when room is full xxxx-- needs game2x2 to be sent from client too 
    //OR... may be 1x1 creator is always ply1... so the moment pl2 gets this reply... it asks him to start
    //BUT in 2x2 the clientside wont do that.. it only continues to add players. Except when the server sends back GOGOGO to everyone
    if (roomCnt.get(myOwnRoom) == 4) {
      console.log("GO GO GO");
      io.in(myOwnRoom).emit("RoomJoining", "Go");
    }
  });

  //Int Array data 1x1
  socket.on("myMoves", function (data) {
    console.log(data);
    socket.to(data[3]).emit("myMoves", data); //data[3]will always be roomNo
    //socket.to(data[3]).emit('myMoves', data);//send to all clients in ROOM except the sender
    //socket.broadcast.emit('myMoves', data);//this is for everyone BUT the sender
    //socket.emit('myMoves', data); // back only to sender
    //io.in("gameRoomId").emit("big-announcement", "the game will start soon");//everyone in room including sender
    if (data[0] === 999) {
      if (roomss[data[3]] != undefined) { //that means it should not have been already deleted
        delete roomss[data[3]];
        roomCnt.delete(data[3]);
        console.log("reset from 999");
      }
    } //delete stuff after last move
  });

  //Int Array data 2x2 server receives arr[0-4] and sendsback[1,2,3]cz plyNum & RoomNum doesnt need to be sentback
  socket.on("myMoves2x2", function (data) {
    console.log(data); //[plyNum,what,move,taken,room]

    var start = data[0] * 3;
    toBsent[start] = data[1];
    toBsent[start + 1] = data[2];
    toBsent[start + 2] = data[3];

    if (toBsent.includes(-1) == false) {
      //only if all the -1 dont exist that means all players moves are filled in
      io.in(data[4]).emit("myMoves2x2", toBsent); //everyone in room including sender
      console.log("sent to ALL: " + toBsent);
      toBsent = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]; //after it is filled by all you can reset it
    }
    //if(data[0]===999){roomss[data[3]] = 0;}//reset it to 0 after last move
  });

  socket.on("disconnect", function () {
    console.log("Player Disconnected x-x-x-x-x-x from Room#" + myOwnRoom);
    if (roomss[myOwnRoom] != undefined) {
      //that means it should not have been already deleted
      delete roomss[myOwnRoom];
      roomCnt.delete(myOwnRoom);
      console.log("reset from DISCONNECT");
    } //delete after last move in case it dint make it to move 999
    toBsent = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];//this could give an error if a ply discnnts during the game as toBsent is still required by the others
    console.log(socket.rooms);
  });
});

//https://excellent-heartbreaking-soup.glitch.me/auth?room=1&pk=35217&gm=2
app.get("/auth", (request, response) => {
  console.log("Room# " + request.query.room + " |PassKey " + request.query.pk + " |Game " +  request.query.gm);
  const para1 = parseInt(request.query.room, 10); //cause QueryStr is always a string
  const para2 = parseInt(request.query.pk, 10);
  const para3 = parseInt(request.query.gm, 10); //1for 1x1... 2 for 2x2

  response.setHeader("Content-Type", "application/json");

  if (roomss[para1] === para2) {
    let cnt = roomCnt.get(para1);
    cnt++;
    roomCnt.set(para1, cnt);
    console.log("Room count..." + roomCnt.get(para1));

    //response.send(JSON.stringify({message: 'Access Granted',ply: cnt}));

    if (para3 === 2) {
      if (cnt <= 4) {
        response.send(JSON.stringify({ message: "Access Granted" }));
      } else {
        response.send(JSON.stringify({ message: "Access Denied" }));
      }
    } else if (para3 === 1) {
      if (cnt <= 2) {
        response.send(JSON.stringify({ message: "Access Granted", ply: cnt }));
      } else {
        response.send(JSON.stringify({ message: "Access Denied", ply: -1 }));
      } //-1 means nothing
    }
  } else {
    //authFAILED
    response.send(JSON.stringify({ message: "Access Denied" }));
  }
});

//https://excellent-heartbreaking-soup.glitch.me/create
app.get("/create", (request, response) => {
  console.log("create Request....");

  response.setHeader("Content-Type", "application/json");

  myCounter++;
  roomCnt.set(myCounter, 1); //1st guy who created the room
  let k = Math.floor(Math.random() * 10000 + 1);
  roomss[myCounter] = k;

  console.log(
    "Room#..." + myCounter + "|key " + roomss[myCounter] + "|ply#  " + roomCnt.get(myCounter));

  response.send(JSON.stringify({ message: "Created", room: myCounter, pk: k }));
});


