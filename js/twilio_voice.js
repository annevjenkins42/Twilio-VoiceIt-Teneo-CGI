"use strict";

const qs = require('querystring');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const TIE = require('@artificialsolutions/tie-api-client');
const dotenv = require('dotenv');
dotenv.config();
const {
    TENEO_ENGINE_URL,
    LANGUAGE_STT,
    LANGUAGE_TTS,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_OUTBOUND_NUMBER
} = process.env;

const postPath = {
    default: '/'
};

const teneoApi = TIE.init(TENEO_ENGINE_URL);
const twilioLanguage = LANGUAGE_STT || 'en-GB'; // See: https://www.twilio.com/docs/voice/twiml/gather#languagetags
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
var teneoSessionId = "";
var confidence = "";
var phone = "";
var flow = "";
var session="";
 var arrears="";
var contractNum="";
var fname="";
var numMissed="";
var daysSince="";
var email="";

// Initiates the biometric authentication solution
var userInput = "Authentication";

console.log("LANGUAGE_STT: " + LANGUAGE_STT);
console.log("LANGUAGE_TTS: " + LANGUAGE_TTS);
console.log("TENEO_ENGINE_URL: " + TENEO_ENGINE_URL);

class twilio_voice {

    // handle incoming twilio message
    handleInboundCalls() {

        // initialise session handler, to store mapping between twillio CallSid and engine session id
        const sessionHandler = this.SessionHandler();

        return async (req, res) => {

            let body = '';

            req.on('data', function (data) {
                body += data;
            });

            req.on('end', async function () {
                // parse the body
                var post = qs.parse(body);

                if(phone === "") {
                    if("phone" in req.query) {
                        phone = "+" + req.query["phone"].replace(/[^0-9]/g, '');
                    }
                    else {
                        phone = post.Caller;
                    }
                }
                console.log("Phone: " + phone);
                console.log("In session: " + session);
                // get the caller id
                const callSid = post.CallSid;

                if(session!="") {
                     teneoSessionId = session;
                     sessionHandler.setSession(callSid, teneoSessionId);
                    session="";
                }
                else {
                // check if we have stored an engine sessionid for this caller
                teneoSessionId = sessionHandler.getSession(callSid);
                }

                // Detect if userinput exists
                if (post.CallStatus === 'in-progress' && post.SpeechResult) {
                    userInput = post.SpeechResult;
                    console.log("User said: " + userInput);
                    // Capture confidence score
                    if (post.Confidence) {
                        confidence = post.Confidence;
                    }
                }

                var parameters = {};
                //var MediaUrl0 = req.query["MediaUrl0"];   
                //parameters["MediaUrl0"] = MediaUrl0;

                // Detect digit input from the user, add additional if statement to capture timeout
                if(post.Digits !== "timeout" && post.Digits) {
                    parameters["keypress"] = post.Digits;
                }

                // Detect if recording exists from input
                if(post.RecordingSid) {
                    parameters["url"] = post.RecordingUrl;
                }

                parameters["phone"] = phone;

                    var contentToTeneo = {'text': userInput, "parameters": JSON.stringify(parameters), "channel":"ivr", "arrearsContractNum":contractNum
                                         , "arrearsAmt":arrears , "arrearsName":fname , "numMissed":numMissed, "daysSince":daysSince, "contractEmail":email};
               

                console.log("Content to Teneo: " + JSON.stringify(contentToTeneo).toString());
                
                if(session!="" && userInput.startsWith("Hi")) {
                    userIhput="switchover success";
                }
                
                // Add "_phone" to as key to session to make each session, regardless when using call/sms
                    teneoResponse = await teneoApi.sendInput(teneoSessionId, contentToTeneo);

                    sessionHandler.setSession(callSid, teneoResponse.sessionId);
                
                if(session!="" && userInput.startsWith("Hi")) {
                    session="";
                }
                
                // Detect if Teneo solution have provided a Twilio action as output parameter
                if(Object.keys(teneoResponse.output.parameters).length !== 0) {
                    if(Object.keys(teneoResponse.output.parameters).includes("twilioAction")) {
                        twilioAction = teneoResponse.output.parameters["twilioAction"];
                    }
                }
               
                console.log("Output response 3: " + teneoResponse.output.text);

                if(twilioAction === postPath.default) {
                    twilioAction = twilioActions.gather_default;
                }

                switch (twilioAction) {

                    // Twilio action to handle voice inputs by end-user, speaking to the end user and then capturing the voice subsequently.
                    case twilioActions.gather_default:
                        var twiml = new VoiceResponse();
                        twiml.gather({
                            input: 'speech dtmf',
                            action: postPath.default,
                            actionOnEmptyResult: false,
                            language: twilioLanguage,
                            timeout: 5,
                            speechTimeout: "auto"
                        }).say({
                            voice: twilioVoiceName,
                            language: twilioLanguage
                        }, teneoResponse.output.text);
                        res.writeHead(200, {'Content-Type': 'text/xml'});
                        res.end(twiml.toString());
                        break;

                    // Twilio action to handle voice recording by end-user, starts with a beep and records the audio to a audio file.
                    case twilioActions.record_default:
                        var twiml = new VoiceResponse();
                        twiml.say({
                            voice: twilioVoiceName,
                            language: twilioLanguage
                        }, teneoResponse.output.text);
                        twiml.record({
                            action: postPath.default,
                            maxLength: 5,
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
                        }, teneoResponse.output.text);
                        twiml.hangup();
                        res.writeHead(200, {'Content-Type': 'text/xml'});
                        res.end(twiml.toString());
                        break;
                }
            });
        }
    }

    handleOutboundCalls() {

        return async (req, res) => {
            const sessionHandler = this.SessionHandler();
            console.log("IN HANDLE OUTBOUND CALLS!");
            const client = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
            phone = "+" + req.query["phone"].replace(/[^0-9]/g, '');  
            //phone = "+" + req.url.replace("/outbound_call", "").replace(/[^0-9]/g, '');
            console.log("Phone: " + phone);
            userInput = req.query["userInput"];   
            if(userInput=="End of contract") {
              phone = "+447397149619";   
            }
             console.log("userInput: " + userInput);
            const url = "https://" + req.headers["host"] + "/";
            console.log("URL: " + url);
            const passedSessionId=req.query["session"];  
            console.log("Passed session: " + passedSessionId);
            if(passedSessionId===undefined || passedSessionId===null || passedSessionId=="") {
                
            }
            else {
               session = passedSessionId;
                teneoSessionId=passedSessionId;   
                 console.log("session: " + teneoSessionId);
                userInput = "switchover success"; 
            }
                    var parameters = {};
                    parameters["phone"] = phone;
            contractNum = req.query["contractNum"];
                if(contractNum===undefined) {
                    contractNum = "";
                }
                console.log("contractNum: " + contractNum);
            arrears= req.query["arrears"];
                if(arrears===undefined) {
                    arrears = "0.00";
                }
                console.log("arrears: " + arrears);
            fname= req.query["fname"];
                if(fname===undefined) {
                    fname = "";
                }
                console.log("fname: " + fname);
            numMissed = req.query["numMissed"];
                if(numMissed===undefined) {
                    numMissed = "";
                }
                console.log("numMissed: " + numMissed);
             daysSince = req.query["daysSince"];
                if(daysSince===undefined) {
                    daysSince = "";
                }
                console.log("daysSince: " + daysSince);
             email = req.query["email"];
                if(email===undefined) {
                    email = "";
                }
                console.log("email: " + email);
                    var contentToTeneo = {'text': userInput, "parameters": JSON.stringify(parameters), "channel":"ivr", "arrearsContractNum":contractNum
                                         , "arrearsAmt":arrears , "arrearsName":fname , "numMissed":numMissed, "daysSince":daysSince, "contractEmail":email};
                
                    console.log("Content to Teneo: " + JSON.stringify(contentToTeneo).toString());
                    // Add "_phone" to as key to session to make each session, regardless when using call/sms
                    teneoResponse = await teneoApi.sendInput(teneoSessionId, contentToTeneo);
                     console.log("Output response 1: " + teneoResponse.output.text);
  
            
          
            client.calls
                .create({
                    //twiml: '<Response><Redirect method="POST">' + url + '</Redirect></Response>',
                    url: url,
                    to: phone,
                    from: TWILIO_OUTBOUND_NUMBER
                })
                .then(call =>
                   // console.log(JSON.stringify(call)); 
                   sessionHandler.setSession(call.sid, teneoSessionId)   
                );
           
                res.writeHead(200, {'Content-Type': 'text/xml'});
                res.end();
        }
    }

    /***
     * SESSION HANDLER
     ***/
    SessionHandler() {

        const sessionMap = new Map();

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
                sessionMap.set(userId, sessionId)
            }
        };
    }
}

module.exports = twilio_voice;
