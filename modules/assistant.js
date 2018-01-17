const config = require('../config.json');
const GoogleAssistant = require('google-assistant');
const path = require('path');
let debug = false;
let client;

const assistantConfig = {
    auth: {
        keyFilePath: path.resolve(__dirname, '../assistant.json'),
        savedTokensPath: path.resolve(__dirname, '../tokens.json'), // where you want the tokens to be saved
    },
    conversation: {
        lang: 'en-US', // defaults to en-US, but try other ones, it's fun!
    },
};

const assistant = new GoogleAssistant(assistantConfig.auth);

const startConversation = (conversation) => {
    // setup the conversation
    conversation
        .on('response', text => client.say(text))
        .on('ended', () => {
            conversation.end();
        })
        // catch any errors
        .on('error', (error) => {
            console.log('Conversation Error:', error);
        });
};

assistant.on('error', (error) => {
    console.log('Assistant Error:', error);
});

function validAssistantCommand(message) {
    if(message !== undefined)
        return message.startsWith(config.nick+':');
    return false
}

function getQuery(message){
    return message.replace(config.nick+': ','');
}

function parse(data){
    client = data.client;
    if (data.message === 'enabledebug') debug = true;
    if (data.message === 'disabledebug') debug = false;

    if(validAssistantCommand(data.message)){
        assistantConfig.conversation.textQuery = getQuery(data.message);
        assistant.start(assistantConfig.conversation, startConversation);
    }
}

module.exports = {
    parse
};
