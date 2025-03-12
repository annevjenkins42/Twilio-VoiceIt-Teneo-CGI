"use strict";

const qs = require('querystring');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const TIE = require('@artificialsolutions/tie-api-client');
const dotenv = require('dotenv');
dotenv.config();
const sessionMap = new Map();
const inputMap = new Map();
var outboundCall = false;

const {
    TENEO_ENGINE_URL,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_OUTBOUND_NUMBER,
    LANGUAGE_STT,
    LANGUAGE_TTS,
    TWILIO_OUTBOUND_NUMBER_WA
} = process.env;

const postPath = {
    default: '/'
};

const teneoApi = TIE.init(TENEO_ENGINE_URL);
const twilioLanguage = LANGUAGE_STT || 'en-US'; // See: https://www.twilio.com/docs/voice/twiml/gather#languagetags
const twilioVoiceName = LANGUAGE_TTS || 'Polly.Joanna'; // See: https://www.twilio.com/docs/voice/twiml/say/text-speech#amazon-polly

let twilioActions = {
    gather_default: '/gather_default',
    record_default: '/record_default',
    outbound_call: '/outbound_call',
    hang_up: '/hang_up'
};
let twilioAction = postPath.default;

/**
 * Variables used to keep track of current state.
 */
var teneoResponse = null;
var confidence = "";

var flow = "";





// Initiates the biometric authentication solution


console.log("TENEO_ENGINE_URL: " + TENEO_ENGINE_URL);
console.log("TWILIO_OUTBOUND_NUMBER: " + TWILIO_OUTBOUND_NUMBER);
console.log("TWILIO_OUTBOUND_NUMBER_WA: " + TWILIO_OUTBOUND_NUMBER_WA);


function _stringify (o)
{
  const decircularise = () =>
  {
    const seen = new WeakSet();
    return (key,val) => 
    {
      if( typeof val === "object" && val !== null )
      {
        if( seen.has(val) ) return;
        seen.add(val);
      }
      return val;
    };
  };
  
  return JSON.stringify( o, decircularise() );
}

function sendDirectTwilioMessage(text, res, triggerFrom, sendFrom) {
    const client = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
if(triggerFrom!==undefined && triggerFrom!==null && triggerFrom!="") {
    console.log('trying to send direct outbound message: ${text}');

client.messages
      .create({
         from: sendFrom,
         body:  text,
         to: triggerFrom
       })
      .then(message => console.log(message.sid));
}
 else {
     //console.log('replying to inbound message: ${text}');
  const message = text;
  const twiml = new MessagingResponse();

  twiml.message(message);

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
   //console.log(`twim1: ${twiml.toString()}`);
 }
}

    // compose and send message
function sendTwilioMessage(teneoResponse, res, triggerFrom, sendFrom) {
const client = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
var mediaUrl=[''];
var mediaUrlStr="";     
// Detect if Teneo solution have provided a Twilio action as output parameter
if(Object.keys(teneoResponse.output.parameters).length !== 0) {
   if(Object.keys(teneoResponse.output.parameters).includes("MediaUrl")) {
      mediaUrlStr = teneoResponse.output.parameters["MediaUrl"];
      
       if( mediaUrlStr!==undefined && mediaUrlStr!==null && mediaUrlStr!="") { 
            mediaUrl[0] = mediaUrlStr;   
           console.log("Media URL in sendTwilioMessage: " + mediaUrlStr);
       }
   }
}
if(triggerFrom!==undefined && triggerFrom!==null && triggerFrom!="") {
    console.log('trying to send outbound message:  + ${teneoResponse.output.text}');

if(mediaUrlStr!="") {
    client.messages
      .create({
         from: sendFrom,
         to: triggerFrom,
         mediaUrL: mediaUrlStr
       })
      .then(message => console.log(message.sid));
}
   
client.messages
      .create({
         from: sendFrom,
         body:  teneoResponse.output.text,
         to: triggerFrom,
         mediaUrL: mediaUrl
       })
      .then(message => console.log(message.sid));
}
 else {
     //console.log('replying to inbound message: ${teneoResponse.output.text}');
  const message = teneoResponse;
  const twiml = new MessagingResponse();

  twiml.message(message);

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
   //console.log(`twim1: ${twiml.toString()}`);
 }
}

class twilio_voice {

    // handle incoming twilio message
    handleInboundCalls() {
const sessionHandler = this.SessionHandler();
const inputHandler = this.InputHandler();
        

        return async (req, res) => {
            //console.log("INBOUND START " );
            let body = '';

            req.on('data', function (data) {
                body += data;
            });

            req.on('end', async function () {
            var phone = "";
            var teneoSessionId;
            var userInput;
            var passedSessionId;
            var mode;
            var contractNum;
            var arrears;
            var fname;
            var numMissed;
            var daysSince;
            var email;
                
             /*   console.log("req.body: " );
            console.log(_stringify(req.body));
                console.log("body: " );
            console.log(_stringify(body));*/
            
            /*if(req.body!=undefined && req.body.phone!=undefined && req.body.mode!=undefined) {
                userInput = req.body.userInput;
                phone = req.body.phone;
                passedSessionId=req.body.session;
                mode=req.body.mode;
                contractNum =req.body.contractNum;
                arrears=req.body.arrears;
                fname=req.body.fname;
                numMissed==req.body.numMissed;
                daysSince=req.body.daysSince;
                email=req.body.email;
            }
            else {*/
            phone = req.query["phone"];     
            passedSessionId=req.query["session"];  
              
            userInput = req.query["userInput"];   
            mode = req.query["mode"];
     
            contractNum = req.query["contractNum"];  
            arrears= req.query["arrears"];    
            fname= req.query["fname"];
            numMissed = req.query["numMissed"];    
            daysSince = req.query["daysSince"];     
            email = req.query["email"];
                
                
             //}
              
                if(userInput===undefined) {
                    userInput = "";
                }
                console.log("userInput: " + userInput);  
                if(userInput!="hi") {
                var post = qs.parse(body);
                //console.log("post: " );
                //console.log(_stringify(post));
                  var from = post.From;
                 //console.log(`from: ${from}`);
                  // Detect if userinput exists
                if (post.CallStatus === 'in-progress' && post.SpeechResult) {
                    userInput = post.SpeechResult;
                    console.log("User said: " + userInput);
                    // Capture confidence score
                    if (post.Confidence) {
                        confidence = post.Confidence;
                    }
                }   
                 
              //console.log("phone: " + phone);  
                if(contractNum===undefined) {
                    contractNum = "";
                }
                //console.log("contractNum: " + contractNum);
         
                if(arrears===undefined) {
                    arrears = "";
                }
                //console.log("arrears: " + arrears);
          
                if(fname===undefined) {
                    fname = "";
                }
                //console.log("fname: " + fname);
            
                if(numMissed===undefined) {
                    numMissed = "";
                }
                //console.log("numMissed: " + numMissed);
             
                if(daysSince===undefined) {
                    daysSince = "";
                }
                //console.log("daysSince: " + daysSince);
            
                if(email===undefined) {
                    email = "";
                }
                //console.log("email: " + email);  
              
            //console.log("Passed session: " + passedSessionId);
            if(passedSessionId===undefined || passedSessionId===null || passedSessionId=="") {
                teneoSessionId=""
            }
            else {
                teneoSessionId=passedSessionId;   
                 //console.log("session: " + teneoSessionId);
                //userInput = "switchoversuccess"; 
                sessionHandler.setSession(phone, teneoSessionId);
            }       
                    
                    
            var TWILIO_MODE = "ivr";   
                 // get the caller id
                const callSid = post.CallSid;
                if(callSid===undefined) {
                    if(post.From== TWILIO_OUTBOUND_NUMBER_WA || post.To==TWILIO_OUTBOUND_NUMBER_WA) {
                        TWILIO_MODE="whatsapp";
                    }
                    else {
                        TWILIO_MODE="sms";
                    }
                }
                //console.log("mode: " + TWILIO_MODE);  
            if((post.From!= TWILIO_OUTBOUND_NUMBER_WA && post.From!=TWILIO_OUTBOUND_NUMBER) || TWILIO_MODE=="ivr") {
  
                //console.log("contractNum: " + contractNum);
            // get message from user
                if(post.Body!==undefined && !post.SpeechResult) {
                    userInput = post.Body;
                }
               console.log(`userInput: ${userInput}`);
                //if(phone === "") {
                    if("phone" in req.query) {
                        phone = "+" + req.query["phone"].replace(/[^0-9]/g, '');
                    }
                    else if(post.From==TWILIO_OUTBOUND_NUMBER || post.From==TWILIO_OUTBOUND_NUMBER_WA) {
                        //do nothing
                        phone = post.To;
                    }
                    else {
                        phone = post.From;
                    }
                //}
                var channel = TWILIO_MODE;
                   
                 if(TWILIO_MODE=="whatsapp") {
                     channel="twilio-whatsapp";
                if(!phone.startsWith("whatsapp:")) {
                    phone = "whatsapp:" + phone;
                }
                if(post.From.startsWith("whatsapp:")) {
                  phone = post.From;  
                } 
                }
                console.log("Phone: " + phone);

                // check if we have stored an engine sessionid for this caller
               if(userInput==undefined || userInput=="") {
                   userInput = inputHandler.getInput(phone);
                   console.log("userInput from Handler: " + userInput);
                   if(userInput==undefined) {
                        userInput="";
                   }
                    /*console.log(`REQUEST (flattened):`);
                    console.log(_stringify(req));            
                    //console.log("body: " );
                    //console.log(_stringify(req.body));
                   res.writeHead(200, {'Content-Type': 'text/xml'});
                    res.end();
                   return;*/
               }
                
                teneoSessionId = sessionHandler.getSession(phone);
                if(teneoSessionId=="" || teneoSessionId==undefined) {
                   var checkphone=phone.replace("whatsapp:","");
                    //console.log("checkphone: " + checkphone);
                    teneoSessionId = sessionHandler.getSession(checkphone);
                    if(teneoSessionId==""  || teneoSessionId==undefined) {
                        checkphone="whatsapp:" + phone;
                         teneoSessionId = sessionHandler.getSession(checkphone);
                        //console.log("checkphone: " + checkphone);
                    }
                }
                //console.log("session ID retrieved: " + teneoSessionId);
                //console.log("mode in inbound: " + TWILIO_MODE);        

                var parameters = {};
                // Detect digit input from the user, add additional if statement to capture timeout
                if(post.Digits !== "timeout" && post.Digits) {
                    parameters["keypress"] = post.Digits;
                    console.log("POST DIGITS: " + post.Digits);
                }

                // Detect if recording exists from input
                if(post.RecordingSid) {
                    parameters["url"] = post.RecordingUrl;
                }
                var MediaUrl0 = post.MediaUrl0;   
                //console.log(`MURL: ${MediaUrl0}`);
                parameters["phone"] = phone;
                if(MediaUrl0===undefined){
                    MediaUrl0="";
                }
                var respondToUser="Hi!";
               if(userInput!="WAIT_FOR_SPEECH") {
                var contentToTeneo = {'text': userInput, "parameters": JSON.stringify(parameters), "channel":channel, "mediaurl":MediaUrl0};
                
                if(post.From==TWILIO_OUTBOUND_NUMBER && req.query["contractNum"]!==undefined) {
                   contentToTeneo = {'text': userInput, "parameters": JSON.stringify(parameters), "channel":channel, "mediaurl":MediaUrl0, "refNum":contractNum
                                         , "arrearsAmt":arrears , "arrearsName":fname , "numMissed":numMissed, "daysSince":daysSince, "contractEmail":email};
                }

                //console.log("Content to Teneo INBOUND: " + JSON.stringify(contentToTeneo).toString());
                
                
                // Add "_phone" to as key to session to make each session, regardless when using call/sms
                    teneoResponse = await teneoApi.sendInput(teneoSessionId, contentToTeneo);
                teneoSessionId = teneoResponse.sessionId;
                //console.log("Session ID in inbound response: " +  teneoSessionId );
                var hintMode = "";
                var hintText;
                // Detect if Teneo solution have provided a Twilio action as output parameter
                if(Object.keys(teneoResponse.output.parameters).length !== 0) {
                    if(Object.keys(teneoResponse.output.parameters).includes("twilioAction")) {
                        twilioAction = teneoResponse.output.parameters["twilioAction"];
                    }
                    if(Object.keys(teneoResponse.output.parameters).includes("twilio_speechModel")) {
                        hintMode = teneoResponse.output.parameters["twilio_speechModel"];
                        if(hintMode=="numbers_and_commands") {
                            hintText="A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99";
                            console.log("hints on");
                        }
                        if(hintMode=="numbers") {
                            hintText="0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99";
                            console.log("hints on");
                        }
                        if(hintMode=="account_number") {
                            hintText="A, B, C, D, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99";
                            console.log("hints on");
                        }
                    }
                }
                   respondToUser = teneoResponse.output.text;
               }
                console.log("TENEO RESPONSE: " + respondToUser);
                   
               
                 if(TWILIO_MODE=="ivr") {
                    sessionHandler.setSession(phone, teneoSessionId);
                if(twilioAction === postPath.default || twilioAction==undefined || twilioAction=="") {
                    twilioAction = twilioActions.gather_default;
                }
                //console.log("twilioAction: " + twilioAction);
                switch (twilioAction) {

                    // Twilio action to handle voice inputs by end-user, speaking to the end user and then capturing the voice subsequently.
                    case twilioActions.gather_default:
                        var twiml = new VoiceResponse();
                        twiml.gather({
                            input: 'speech dtmf',
                            action: postPath.default,
                            actionOnEmptyResult: false,
                            language: twilioLanguage,
                            timeout: 3,
                            speechModel: "phone_call",
                            hints: hintText
                        }).say({
                            voice: twilioVoiceName,
                            language: twilioLanguage
                        }, respondToUser);
                        res.writeHead(200, {'Content-Type': 'text/xml'});
                        res.end(twiml.toString());
                        break;

                    // Twilio action to handle voice recording by end-user, starts with a beep and records the audio to a audio file.
                    case twilioActions.record_default:
                        var twiml = new VoiceResponse();
                        twiml.say({
                            voice: twilioVoiceName,
                            language: twilioLanguage
                        }, respondToUser);
                        twiml.record({
                            action: postPath.default,
                            maxLength: 4,
                            trim: 'do-not-trim'
                        });
                        res.writeHead(200, {'Content-Type': 'text/xml'});
                        res.end(twiml.toString());
                        break;

                    case twilioActions.hang_up:
                        var twiml = new VoiceResponse();
                        twiml.say({
                            voice: twilioVoiceName,
                            language: twilioLanguage
                        }, respondToUser);
                        twiml.hangup();
                        res.writeHead(200, {'Content-Type': 'text/xml'});
                        res.end(twiml.toString());
                        break;
                }

              
                }
                else {
                    sessionHandler.setSession(phone, teneoSessionId);
                     console.log("about to send message via " + TWILIO_MODE);
                    // return teneo answer to twilio
                   if(TWILIO_MODE=="sms") {
                       sendTwilioMessage(teneoResponse, res, phone, TWILIO_OUTBOUND_NUMBER);
                        console.log(" number " + TWILIO_OUTBOUND_NUMBER);
                   }
                    else {
                        
                    sendTwilioMessage(teneoResponse, res, phone, TWILIO_OUTBOUND_NUMBER_WA);
                        console.log(" number " + TWILIO_OUTBOUND_NUMBER_WA);
                    }
                }
                  
                   
                } 
                }
                else {
                userInput="";
                res.writeHead(200, {'Content-Type': 'text/xml'});
                res.end();
                }
                
                
            });
                
        }
    }

    handleOutboundCalls() {
  const sessionHandler = this.SessionHandler();
    const inputHandler = this.InputHandler();
        return async (req, res) => {
             var TWILIO_MODE = "ivr";   
            const client = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
            console.log("IN HANDLE OUTBOUND !" + TWILIO_MODE);
            //console.log(`REQUEST (flattened):`);
            //console.log(_stringify(req));            
            //console.log("body: " );
            //console.log(_stringify(req.body));
            
            var phone = "";
            var teneoSessionId;
            var userInput;
            var passedSessionId;
            var mode;
            var contractNum;
            var arrears;
            var fname;
            var numMissed;
            var daysSince;
            var email;
            
            if(req.body!=undefined && req.body.phone!=undefined) {
                userInput = req.body.userInput;
                phone = req.body.phone;
                passedSessionId=req.body.session;
                mode=req.body.mode;
                contractNum =req.body.contractNum;
                arrears=req.body.arrears;
                fname=req.body.fname;
                numMissed==req.body.numMissed;
                daysSince=req.body.daysSince;
                email=req.body.email;
            }
            else {
            phone = "+" + req.query["phone"].replace(/[^0-9]/g, '');           
            passedSessionId=req.query["session"];  
              
            userInput = req.query["userInput"];   
            mode = req.query["mode"];
     
            contractNum = req.query["contractNum"];  
            arrears= req.query["arrears"];    
            fname= req.query["fname"];
            numMissed = req.query["numMissed"];    
            daysSince = req.query["daysSince"];     
            email = req.query["email"];
                
                
             }
            console.log("Passed session: " + passedSessionId);
            var parameters = {};
            parameters["phone"] = phone;
            const url = "https://" + req.headers["host"] + "/";
            console.log("URL: " + url);
            if(userInput===undefined || userInput===null || userInput=="") {
              userInput="WAIT_FOR_SPEECH";
            }
             console.log("userInput: " + userInput);
            if(contractNum===undefined) {
                    contractNum = "";
                }
                console.log("contractNum: " + contractNum);
                if(arrears===undefined) {
                    arrears = "";
                }
                console.log("arrears: " + arrears);
                if(fname===undefined) {
                    fname = "";
                }
                console.log("fname: " + fname);
            
                if(numMissed===undefined) {
                    numMissed = "";
                }
                console.log("numMissed: " + numMissed);
              
                if(daysSince===undefined) {
                    daysSince = "";
                }
                console.log("daysSince: " + daysSince);
             
                if(email===undefined) {
                    email = "";
                }
               // console.log("email: " + email);
            
                if(mode!==undefined) {
                    TWILIO_MODE = mode;
                    var channel = TWILIO_MODE;
                    if(mode=="whatsapp") {
                        channel = "twilio-whatsapp";
                    }

                }
                console.log("mode: " + TWILIO_MODE);    
            if(passedSessionId===undefined || passedSessionId===null || passedSessionId=="") {
                teneoSessionId="";
            }
            else {
                teneoSessionId=passedSessionId;   
                console.log("session: " + teneoSessionId);
               sessionHandler.setSession(phone, teneoSessionId);
            }
             console.log("mode XXX: " + TWILIO_MODE);    
            console.log("phone: " + phone);
            if(TWILIO_MODE=="ivr") {
                //const callSid = post.CallSid;
                outboundCall = true;
                //const url = "https://" + req.headers["host"] + "/?phone="+phone+"&session="+teneoSessionId+"&contractNum="+contractNum+"&email="+email+"&userInput="+userInput+"&arrears="+arrears+"&fname="+fname+"&numMissed="+numMissed+"&daysSince="+daysSince;
               const url = "https://" + req.headers["host"] + "/";
                console.log("URL: " + url);
                client.calls
                .create({
                    url: url,
                    to: phone,
                    from: TWILIO_OUTBOUND_NUMBER
                })
                .then(call =>
                   //console.log(JSON.stringify(call)); 
                   sessionHandler.setSession(phone, teneoSessionId)   
                );
                teneoSessionId = sessionHandler.getSession(phone);
                console.log("session: " + teneoSessionId);
                inputHandler.setInput(phone, userInput);
                res.writeHead(200, {'Content-Type': 'text/xml'});
                res.end();  
            }
            else {
               if(TWILIO_MODE=="sms" || TWILIO_MODE=="whatsapp") {
                    var contentToTeneo = {'text': userInput, "parameters": JSON.stringify(parameters), "channel":channel, "reftNum":contractNum
                                         , "arrearsAmt":arrears , "arrearsName":fname , "numMissed":numMissed, "daysSince":daysSince, "contractEmail":email};
                    console.log("Content to Teneo: " + JSON.stringify(contentToTeneo).toString());
                    // Add "_phone" to as key to session to make each session, regardless when using call/sms
                    teneoResponse = await teneoApi.sendInput(teneoSessionId, contentToTeneo);
                     teneoSessionId = teneoResponse.sessionId;
                    console.log("session ID retrieved3: " + teneoSessionId);
                     console.log("Output response 1: " + teneoResponse.output.text);
               }      
          
            // store engine sessionid for this sender
            
               if(TWILIO_MODE=="sms") {
                   sessionHandler.setSession(phone, teneoSessionId);
                // return teneo answer to twilio
                sendTwilioMessage(teneoResponse, res, phone,TWILIO_OUTBOUND_NUMBER);
                       teneoSessionId = sessionHandler.getSession(phone);
                   console.log("session ID retrieved4: " + teneoSessionId);
                    res.writeHead(200, {'Content-Type': 'text/xml'});
               }
               else if(TWILIO_MODE=="directsms") {
                   sendDirectTwilioMessage(userInput, res, phone,TWILIO_OUTBOUND_NUMBER);
                   res.writeHead(200, {'Content-Type': 'text/xml'});
               }
               else if(TWILIO_MODE=="directwa") {
                   sendDirectTwilioMessage(userInput, res, "whatsapp:"+phone, TWILIO_OUTBOUND_NUMBER_WA);
                       teneoSessionId = sessionHandler.getSession("whatsapp:"+phone);
                       res.writeHead(302,  {Location: 'https://web.whatsapp.com'});
               }   
            else {
                sessionHandler.setSession("whatsapp:"+phone, teneoSessionId);
                // return teneo answer to twilio
                sendTwilioMessage(teneoResponse, res, "whatsapp:"+phone, TWILIO_OUTBOUND_NUMBER_WA);
                       teneoSessionId = sessionHandler.getSession("whatsapp:"+phone);
                console.log("session ID retrieved4: " + teneoSessionId);
                if(passedSessionId===undefined || passedSessionId===null || passedSessionId=="") {
                    res.writeHead(302,  {Location: 'https://web.whatsapp.com'});
                 }
                else {
                    res.writeHead(200, {'Content-Type': 'text/xml', Location: 'https://api.whatsapp.com/send?phone=+14155238886'});
                }
            }
                    
                //res.writeHead(200, {'Content-Type': 'text/xml', Location: 'https://api.whatsapp.com/send?phone=+14155238886'});
                //res.writeHead(302,  {Location: 'https://api.whatsapp.com/send?phone=+14155238886'});

                res.end();  
            }        
        }
    }
    
SessionHandler() {
      

        return {
            getSession: (userId) => {
                if (sessionMap.size > 0) {
                    return sessionMap.get(userId);
                }
                else {
                    return "";
                }
            },
            setSession: (userId, sessionId) => {
                sessionMap.delete(userId);
                sessionMap.set(userId, sessionId);
            },
            clearSession: (userId) => {
                 sessionMap.delete(userId);
            }
        };
    }

    InputHandler() {
      

        return {
            getInput: (userId) => {
                if (inputMap.size > 0) {
                    return inputMap.get(userId);
                }
                else {
                    return "";
                }
            },
            setInput: (userId, sessionId) => {
                inputMap.delete(userId);
                inputMap.set(userId, sessionId);
            },
            clearInput: (userId) => {
                 inputMap.delete(userId);
            }
        };
    }
    
}

module.exports = twilio_voice;
