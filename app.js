'use strict';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
let _ = require('lodash');
let getLocation = require('./geoCode');

let userDB = {}
let providerDB = {
  1234: {
    foodDesc: "3 pizzas", 
    location: "201 E Randolph Street Chicago, IL"
  },
  4567: {
    foodDesc: "20 bagels", 
    location: "233 S Wacker Dr, Chicago, IL"
  }
}
let seekerDB = {}

// Imports dependencies and set up http server
const 
  request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  app = express().use(body_parser.json()); // creates express http server

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Accepts POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {  
  // Parse the request body from the POST
  let body = req.body;
  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {
    body.entry.forEach(function(entry) {
      let webhook_event = entry.messaging[0];
      let sender_psid = webhook_event.sender.id;
      console.log("SENDER DET" ,webhook_event.sender);
      console.log('Sender ID: ' + sender_psid);
      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);        
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }
      
    });
    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {
  
  /** UPDATE YOUR VERIFY TOKEN **/
  const VERIFY_TOKEN = "<YOUR VERIFY TOKEN>";
  
  // Parse params from the webhook verification request
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
    
  // Check if a token and mode were sent
  if (mode && token) {
  
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
      // Respond with 200 OK and challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
});

function handleMessage(sender_psid, received_message) {
  let response; 
  if (received_message.text == 'geolocate') {
    console.log("geolocate")
    getLocation("201 E Randolph Street Chicago, IL", "233 S Wacker Dr, Chicago, IL")
  }

  console.log("MESSAGE: ", received_message);
  let currentUser = userDB[sender_psid];
  //Provider in food step
  if(currentUser && currentUser['type'] == 'PROVIDER' && currentUser['stepType']== 'food'){
    //arp
    providerDB[sender_psid] = {foodDesc: received_message.text ,location: ""};
    console.log("Provider is in food step");
    response = {
      "text": `Great! What's your location?`
    }
    currentUser['stepType'] = 'location';
    userDB[sender_psid] = currentUser;
  } else if (currentUser && currentUser['type'] == 'PROVIDER' && currentUser['stepType']== 'location'){
    //arp
    let providerDetails = providerDB[sender_psid];
    providerDetails['location'] = received_message.text;
    console.log("Provider is in location step");
    response = generateCarouselForDropoffs();
    callSendAPI(sender_psid, {"text": `These are the available food drop off locations near you. Please visit at your convenience.`})
    currentUser['stepType'] = 'finish';
    userDB[sender_psid] = currentUser;
  }

  //Seeker in location step
  if(currentUser && currentUser['type'] == 'SEEKER' && currentUser['stepType']== 'location'){
    //arp
    seekerDB[sender_psid] = {location: received_message.text};
    if(Object.keys(providerDB).length == 0){
      response = {
        "text": `Thank you for providing your location! Currently there are no food providers available!`
      }
    } else {
      response = generateCarousel();
      callSendAPI(sender_psid, {"text": `These are the available food pickup locations nearby. Please visit at your convenience.`})
    }
    

    currentUser['stepType'] = 'finish';
    userDB[sender_psid] = currentUser;
  } 


  // if (received_message.text) {
  //   response = {
  //     "text": `You sent the message: "${received_message.text}". Now send me an attachment!`
  //   }
  // }
  
  let commonGreetings = ["hi", "hello", "start" , "get started"]
  if(commonGreetings.indexOf(received_message.text.toLowerCase()) >= 0 ) {
    console.log("common greeting entered");
    
    response = generateQuickReplies();
  }
  if (received_message && received_message.quick_reply && received_message.quick_reply.payload === 'SEEKER') {
    response = userTypeSelected("SEEKER", sender_psid);

  } 
  if (received_message && received_message.quick_reply && received_message.quick_reply.payload === 'PROVIDER') {
    response = userTypeSelected("PROVIDER", sender_psid);
  }  
  if(response == ''){
    response = {
      "text": `Sorry ! We don't understand`
    }
  }

  console.log("UserDB : " , userDB);
  console.log("ProviderDB : ",providerDB);
  console.log("SeekerDB : ",seekerDB);
  
  // Send the response message
  callSendAPI(sender_psid, response);    
}

function handlePostback(sender_psid, received_postback) {
  console.log('ok')
   let response;
  // Get the payload for the postback
  let payload = received_postback.payload;
  console.log(payload);
  // Set the response based on the postback payload
  if (payload === "GET_STARTED") {
    console.log(12345);
    response = generateQuickReplies();
  }

  if (payload === 'yes') {
    response = { "text": "Thanks!" }
  } else if (payload === 'no') {
    response = { "text": "Oops, try sending another image." }
  }
  callSendAPI(sender_psid, response);
}

function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  console.log(request_body);
  
  
  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  }); 
}


function genQuickReply(text, quickReplies) {
  let response = {
    text: text,
    quick_replies: []
  };

  for (let quickReply of quickReplies) {
    response["quick_replies"].push({
      content_type: "text",
      title: quickReply["title"],
      payload: quickReply["payload"]
    });
  }

  return response;
}

function userTypeSelected(type, psid) {
  //userDB[psid] = {type:type};
  
  if(type === 'PROVIDER'){
    userDB[psid] = {type:type , stepType: "food"};
    return { "text": `What kind of food do you have?` }
  } else {
    userDB[psid] = {type:type , stepType: "location"};
    return { "text": `What is your location?` }
  }
  
}

function generateQuickReplies() {
  let quickReplies = [
    {
      title:"I am a food seeker",
      payload: "SEEKER"
    },
    {
      title:"I am a food provider",
      payload: "PROVIDER"
    }
  ]
  return genQuickReply("How would you describe yourself?", quickReplies)
}

function generateCarousel() {
  let returnObj = {
    "attachment":{
      "type":"template",
      "payload":{
        "template_type":"generic",
        "elements":[]
      }
    }
  }

  _.forEach(providerDB, (item, index) => {
    console.log(index);
    
    let image_url = "https://images.unsplash.com/photo-1498837167922-ddd27525d352?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60"
    if (index == 0 ) {
      image_url = "https://images.unsplash.com/photo-1513104890138-7c749659a591?ixlib=rb-1.2.1&w=1000&q=80"
    }
    if (index == 1 ) {
      image_url = "https://i0.wp.com/images-prod.healthline.com/hlcmsresource/images/AN_images/are-bagels-vegan-1296x728-feature.jpg"
    }
    let foodItem = {
      "title": item.foodDesc,
      "image_url": image_url,
      "subtitle":`${item.location} - ${_.random(1, 5)} miles`
    }
    returnObj.attachment.payload.elements.push(foodItem)
  })
  return returnObj
}

function generateCarouselForDropoffs() {
  return {
    "attachment":{
      
      "type":"template",
      "payload":{
        "template_type":"generic",
        "elements":[
          {
            "title": "Dropoff location 1: Willis tower",
            "image_url":"http://s3.amazonaws.com/architecture-org/files/buildings/willis-tower-sears-tower-01-ear-2.jpg",
            "subtitle":`${_.random(1, 3)} miles away`
          }, 
          {
          "title": "Dropoff location 2: Millenium park",
          "image_url":"https://i1.wp.com/chicagoonthecheap.com/lotc-cms/wp-content/uploads/The-Bean-Millennium-Park-LG.jpg?fit=800%2C1066&ssl=1",
          "subtitle":`${_.random(3, 6)} miles away`
          }
        ]
      }
    }
  }
}