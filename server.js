const express = require("express");
const socket = require("socket.io");
const cors = require("cors");
const app = express();
app.use(cors());

var roomss = [];
var roomCnt = new Map(); //keeps rooms count of players
var myCounter = 0; //keeps incrementing a room
var initializer =  [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]; //0-11 need 12 elements for 2x2  
var my2dArr = new Array();

app.use(express.static("public"));

const server = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + server.address().port);
});

var io = socket(server);
io.on("connection", function (socket) {
  console.log("Player Connected...." + socket.id); //Not sending anything back cz by default a connected event is raised at the client... so i'll know

  var myOwnRoom; //a seperate copy of this variable will belong to individual sockets for 1x1
  
  

  socket.on("RoomJoining", function (data) {
    console.log("JoiningRequest from " + data);
    socket.join(data);
    console.log("Server rooms variable:" + socket.rooms);
    //for (const room of socket.rooms) { console.log("===> " + room);} //room only contains its own socketId and the name of the room that this socket connected to
    socket.emit("RoomJoining", "Joined room #" + data);
    console.log("preROOM: " + myOwnRoom);
    myOwnRoom = data; //used incase of sudden disconnection
    console.log("postROOM: " + myOwnRoom);
    console.log("checking 2dArr: " + my2dArr[myOwnRoom]);//should be undefined at the moment
    //for 2x2's all players to start when room is full xxxx-- needs game2x2 to be sent from client too 
    //OR... may be 1x1 creator is always ply1... so the moment pl2 gets this reply... it asks him to start
    //BUT in 2x2 the clientside wont do that.. it only continues to add players. Except when the server sends back GOGOGO to everyone
    if (roomCnt.get(myOwnRoom) == 4) {
      my2dArr[myOwnRoom] = Array.from(initializer); //now the 2d array at index "myOwnRoom" has a value = [-1,-1,-1, ... -1]
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
    console.log("Received: " + data); //[plyNum,what,move,taken,room]... data[4] will always be the room#

    var start = data[0] * 3;
    my2dArr[data[4]][start] = data[1];
    my2dArr[data[4]][start + 1] = data[2];
    my2dArr[data[4]][start + 2] = data[3];
    var toBsent = my2dArr[data[4]];
    console.log("SettingUp >>  " + toBsent);   
    

    if (!toBsent.includes(-1)) { //only if all the -1 dont exist ... that means all players moves are filled in
      io.in(data[4]).emit("myMoves2x2", toBsent); //everyone in room including sender
      console.log("---------sent to ALL: " + toBsent);   
      
      //How to reset the my2dArr[room#] thats keeping track of the moves for the next set of moves to be filled in
      //1.if game is going on normally with no deaths OR the game is fully ended... for both cases reinitialise the my2dArr 
      //2.if there may be a few finishes but the game still hasnt ended, then we cant make those deaths into -1 cz you will lose their information
      let finishes = toBsent.filter(x => x === 999).length;          
      if( (!toBsent.includes(999)) || finishes===3 || //if not a single 999(finish)is there(means game is on) ...OR... (3 finishes... OR ...2 finishes of the same team)... means game is over  
              (toBsent[0]===999 && toBsent[3]===999) || (toBsent[6]===999 && toBsent[9]===999) )
          { toBsent = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]; }//reset after it was sent.. dont use "= initializer;"... the value of initializer will also get changed      
      else{
          //but if 999 is there & the Game hasnt ended.. dont disturb those 3vals.. and put -1 for the others
          for(var i =0; i<12; i++ ){
            if(toBsent[i]===999){i+=2;}//dont touch (this value & next 2 vals) of this finished player
            else{toBsent[i] = -1;}   //any other that isnt 999(& its 2 other vals) must be reset to -1
           }
        }
    my2dArr[data[4]] = toBsent;
    console.log("resetted 2dArr with toBsent: " + my2dArr[data[4]]);      
    }      
  });

  socket.on("disconnect", function () {
    console.log("Player Disconnected x-x-x-x-x-x from Room#" + myOwnRoom);
    //I think you need to do this only if the game is over... and not a random browserclose
    if (roomss[myOwnRoom] != undefined) {
      //that means it should not have been already deleted
      delete roomss[myOwnRoom];
      roomCnt.delete(myOwnRoom);
      console.log("reset from DISCONNECT");
    } //delete after last move in case it dint make it to move 999
    
    console.log(socket.rooms);
  });

  //For Cheater who shuts browser... server will receive [positionInArray,present,taken].  toBsent will set [999, present, taken]
  socket.on("Cheater", function (data) {
    console.log("From Cheater... " + data); 

    var start = data[0];//this is already the plyNum*3.. so server doesnt need to do calculations to find the position in toBeSent
    my2dArr[myOwnRoom][start] = 999;//bcz he cheated
    my2dArr[myOwnRoom][start + 1] = data[1];
    my2dArr[myOwnRoom][start + 2] = data[2];
    //Now toBsent will never have -1,-1,-1 at the position of the player who discnnted, hence it will never wait
    console.log("reset from Cheater: " + my2dArr[myOwnRoom]);//for that players moves..& send the moves to everyone
     
  });


});//socket ends herexxxxxxxxxxxxx


//https://excellent-heartbreaking-soup.glitch.me/auth?room=1&pk=35217&gm=2
app.get("/auth", (request, response) => {
  console.log("Room# " + request.query.room + " |PassKey " + request.query.pk + " |Game " +  request.query.gm);
  const para1 = parseInt(request.query.room, 10); //cause QueryStr is always a string
  const para2 = parseInt(request.query.pk, 10);
  const para3 = parseInt(request.query.gm, 10); //1for 1x1... 2 for 2x2

  response.setHeader("Content-Type", "application/json");

  if (roomss[para1] === para2) {//authPassed!
    let cnt = roomCnt.get(para1);
    cnt++;
    roomCnt.set(para1, cnt);
    console.log("Room count..." + roomCnt.get(para1));

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
    
  } else { //authFAILED
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

  console.log("Room#..." + myCounter + "|key " + roomss[myCounter] + "|ply#  " + roomCnt.get(myCounter));

  response.send(JSON.stringify({ message: "Created", room: myCounter, pk: k }));
});


