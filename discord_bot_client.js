var auth = require('./auth.json');
const Discord = require('discord.js');
const discord_Helper = require('./discord_bot_client_helper');
var atob = require('atob');
var schedule = require('node-schedule');
const fs = require('fs');
var gsjson = require('google-spreadsheet-to-json');
var creds = require('./google-generated-creds.json');
const db = require('./db_helper');
const { Client, Intents } = require('discord.js');
const intents = new Intents([Intents.NON_PRIVILEGED, "GUILD_MEMBERS"])


let client = new Client({ ws: { intents } });


var mainFunct = async () => {

    // result = await init(settings);

    // var right = checkAdminRights(msg);

    client.on('ready', (res) => {
        var db_helper = db();
        db_helper.guild_all_rows().then((guildRows) => {
            guildRows.forEach(async (gRow, g_index) => {
                let eventRows = await db_helper.event_all_rows(gRow.ID);
                eventRows.forEach(async (eRow, e_index) => {
                    let settings = {
                        ...eRow,
                        guildID: gRow.ID,
                        guild_Discord_ID: gRow.Discord_ID,
                        Developer_ID: gRow.Developer_ID,
                        dis_client: client
                    }
                    var discord_client_helper = discord_Helper();
                    discord_client_helper.setupScheduler(settings);
                })
            })
        })
    });


    // accept all messages from all guilds
    client.on('message', async (msg) => {
        var discord_client_helper = discord_Helper();
        discord_client_helper.messageHandler(msg, client);
    })

    client.login(atob(auth.token));
}

module.exports = mainFunct;