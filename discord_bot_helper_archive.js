var auth = require('./auth.json');
const Discord = require('discord.js');
var atob = require('atob');
var schedule = require('node-schedule');
const fs = require('fs');
var gsjson = require('google-spreadsheet-to-json');
var creds = require('./google-generated-creds.json');
var sheet = require('./sheet.json');

const guildID = "442656148739457034";
const channelID = "588743997665705985";
// const guildMemberRoleNumber = "442657945017253892";
// const guildMember = "<@&442657945017253892>";

const siegeMemberRoleNumber = "632016115480133644";
const siegeMember = "<@&632016115480133644>";

const me = "<@548897775576678442>";
const client = new Discord.Client();

var readFile = (path) => {
    var rawdata = fs.readFileSync(path);
    var obj = JSON.parse(rawdata);
    return obj;
}

var writeFile = (obj, path) => {
    let data = JSON.stringify(obj);
    fs.writeFileSync(path, data);
}

var readSettings = () => {
    var credentials = atob(creds.json);
    var spreadSheet = readFile('sheet.json');

    let prom = gsjson({
        spreadsheetId: spreadSheet.sheet,
        credentials: credentials,
        worksheet: spreadSheet.workSheet
        // other options...
    });

    prom.then((obj) => { console.log(obj) });
    return prom;

}

var sendForms = () => {
    readSettings().then((ws) => {
        var workS = ws[0];
        client.channels.get(channelID).send(siegeMember + ' Forms for the week have been updated on ' + workS.updated + ', and here they are! \n' + workS.g_forms_link);
    })
        .catch((err) => {

        });
}


var schedulerController = (rule, control) => {
    var sche = schedule.scheduleJob(rule, function () {
        if (control && control === 'initial') {
            sendForms();
        }
        if (control && control === 'vacation') {
            get_non_attendance(null, control);
        }
        else {
            get_attendance(null, control);
        }
    });

}

var schedulerProcess = (dayOfWeek, hour, minute, control) => {
    var rule = new schedule.RecurrenceRule();
    rule.dayOfWeek = dayOfWeek;
    rule.hour = hour;
    rule.minute = minute;
    schedulerController(rule, control);
}

var scheduler = () => {
    schedulerProcess(3, 21, 1, 'initial');
    schedulerProcess(4, 21, 1);
    schedulerProcess(4, 23, 1, 'vacation');
    schedulerProcess(5, 9, 1, 'vacation');
    schedulerProcess(5, 21, 1);
    schedulerProcess(4, 8, 51);
    schedulerProcess(5, 8, 51);
    schedulerProcess(0, 21, 00, 'warning');
}

var checkAdminRights = (msg) => {
    var right = msg.member.roles.some(role => role.name.includes("Officer") || role.name.includes("Admin")
        || role.name.includes("Queen") || role.name.includes("King") || role.name.includes("Moderator"));

    if (!right) {
        msg.delete(1000);
        msg.reply("Sorry you dont have permission to use this :(");
    }
    return right;
}


var getDiscordGuildies = (discordGuildMembers, completed) => {

    console.log('List of completed from Sheet', completed);
    var discordCompletedMembers = completed.map((complete) => {
        var filterRes = discordGuildMembers.filter(
            (member) => {
                var famName = complete.familyName.trim().toLowerCase();
                var userName = member && member.user.username ? member.user.username.toString().trim().toLowerCase() : '';
                var nickName = member && member.nickname ? member.nickname.toString().trim().toLowerCase() : '';
                var compare = userName.includes(famName) ||
                    nickName.includes(famName);
                return compare;
            }
        )
            .map((member) => {
                return {
                    'username': member.user.username,
                    'user': {
                        'id': member.user.id
                    }
                    // member.user.username.includes('[') && member.user.username.includes(']') ? member.user.username :  
                }
            });
        return filterRes[0];
    }).filter((complete) => complete !== undefined);


    return discordCompletedMembers;
}


var getGoogleSheet = () => {
    return new Promise((resolve, reject) => {

        var credentials = atob(creds.json);

        var spreadSheetID = readFile('sheet.json').sheet;

        gsjson({
            spreadsheetId: spreadSheetID,
            credentials: credentials,
            worksheet: "0"
            // other options...
        })
            .then((completed) => {
                resolve(completed);
            })
            .catch((err) => {
                console.log(err);
                resolve(err);
                if (msg) {
                    msg.channel.send('Sorry not able to read sheet! ' + me + ' please help!');
                }
                else {
                    client.channels.get(channelID).send('Sorry not able to read sheet! ' + me + ' please help!');
                }
            });

    })
}

var filterAttendance = () => {
    // var propertyArr = Object.keys(data[0]).filter((prop) => prop.startsWith("areYouAbleToJoinSiegeWar"));

    // if (propertyArr.length > 0) {
    //     var property = propertyArr[0];
    //     data.filter((row)=> {
    //        row[propertyArr].toLowerCase() == 'no' 
    //     })
    // }
    // else {
    //     msg.channel.send('Sorry not able to read sheet! Property reading has failed :( ' + me + ' please help!');
    // }
}



var get_non_attendance = (msg, control) => {

    getGoogleSheet().then((completed) => {
        var discordGuildMembers = client.guilds.get(guildID).roles.find("id", siegeMemberRoleNumber).members;

        var non_attendees = completed.filter((complete) => {
            var property = Object.keys(complete).filter((key) => key.toLowerCase().startsWith('areyouabletojoinsiegewar'));
            return complete[property] == 'No';
        })

        var discordNonAttendees = getDiscordGuildies(discordGuildMembers, non_attendees);

        console.log('Non Attendees : ', discordNonAttendees);

        var discordNonAttendeeMembers = discordNonAttendees.map((user) => {
            return '<@' + user.user.id + '>';
        });

        var spammer = discordNonAttendeeMembers.join('\n');

        readSettings().then((ws) => {
            var workS = ws[0];

            var spamMessage = 'Thank you for filling RSVP ' + workS.updated + ' for this week!\n' +
                'Please be reminded to set your vacation status to [Yes] before siege!' + '\n' + spammer +
                '\nAny issues please inform ' + me;

            console.log('Message : ' + spamMessage);

            if (msg) {
                msg.delete(1000);
                msg.channel.send('Vacation reminder will be sent shortly :)');
            }
            client.channels.get(channelID).send(spamMessage);
        })
            .catch((err) => {

            });
    })

}

var get_attendance = (msg, control) => {

    getGoogleSheet().then((completed) => {
        var discordGuildMembers = client.guilds.get(guildID).roles.find("id", siegeMemberRoleNumber).members;

        var discordCompletedMembers = getDiscordGuildies(discordGuildMembers, completed);

        var discordUncompletedMembers_raw = discordGuildMembers.filter((member) => {
            var ind = discordCompletedMembers.findIndex(complete => {
                var userName = member && member.user.username ? member.user.username : '';
                return complete.username === userName;
            });
            return ind === -1 ? true : false;
        });

        // console.log('unCompletedmembers : ', discordUncompletedMembers_raw.filter((member) => {
        //     return member && member.user && member.user.username && member.user.username.toString().includes('Thervi') ? member.user.username : ''
        // }));

        var discordUncompletedMembers = discordUncompletedMembers_raw.map((user) => {
            return '<@' + user.user.id + '>';
        });

        var spammer = discordUncompletedMembers.join('\n');

        readSettings().then((ws) => {
            var workS = ws[0];

            var spamMessage =
                control && control == 'warning' ?
                    'Unfortunately the below list of members have failed to fill up RSVP for the week (' + workS.updated + ')  :(\n' +
                    spammer + '\nIf you have already filled the form but still see your name here inform ' + me :
                    'Please fill up the document/s prepared on ' + workS.updated + ' for this week!\n' +
                    workS.g_forms_link + '\n' + spammer + '\nIf you have already filled the document but still see your name here inform ' + me;

            console.log('Message : ' + spamMessage);

            if (msg) {
                msg.delete(1000);
                msg.channel.send(control && control == 'warning' ? 'Warnings to be issued :\'(' : 'Announcements will be updated shortly :)');
            }
            client.channels.get(channelID).send(spamMessage);
        })
            .catch((err) => {

            });
    })

}


module.exports = (res) => {

    client.on('ready', () => {
        if (res) {
            res.write('\n' + `Logged in as ${client.user.tag}!`);
        } else {
            console.log(`Logged in as ${client.user.tag}!`);
        }
        var sche = scheduler();

    });

    client.on('message', msg => {

        // if (msg.content.startsWith('!update_forms') && checkAdminRights(msg)) {
        //     var msgArr = (msg.content.split(' '));
        //     var link = msgArr.length > 0 ? msgArr[1] : 'no link defined, please contact Kiki';
        //     msg.delete(1000);
        //     writeFile({
        //         message: link
        //     }, 'message.json');
        //     sendForms();
        //     msg.channel.send('Forms for the week updated.');
        // }

        // if (msg.content.startsWith('!update_sheet') && checkAdminRights(msg)) {
        //     var msgArr = (msg.content.split(' '));
        //     var sheet = msgArr.length > 0 ? msgArr[1] : 'no sheet defined, please contact Kiki';
        //     msg.delete(1000);
        //     writeFile({
        //         sheet: sheet
        //     }, 'sheet.json');
        //     msg.channel.send('Sheet for the week updated.');
        // }


        if (msg.content === '!rsvp_help' && checkAdminRights(msg)) {
            var guide = "Tell current time : \n!tell_time" +
                "\n2)Send Announcements : \n!send_announcements" +
                "\n3)Send Reminder : \n!check_members" +
                "\n4)Warn Members : \n!warn_members" + 
                "\n5)Remind Vacationers : \n!send_vacation";
            msg.delete(1000);
            msg.channel.send(guide);

        }

        if (msg.content === '!tell_time' && checkAdminRights(msg)) {
            var datetime = (new Date()).toLocaleString();
            msg.delete(1000);
            msg.channel.send(datetime);
        }

        if (msg.content === '!send_announcements' && checkAdminRights(msg)) {
            msg.delete(1000);
            sendForms();
        }

        if (msg.content === '!check_members' && checkAdminRights(msg)) {
            get_attendance(msg);
        }

        if (msg.content === '!warn_members' && checkAdminRights(msg)) {
            get_attendance(msg, 'warning');
        }

        if (msg.content === '!send_vacation' && checkAdminRights(msg)) {
            get_non_attendance(msg);
        }

        if (msg.content === '!read_settings' && checkAdminRights(msg)) {
            readSettings(msg);
        }

        if (msg.content === '!best_castle?' && checkAdminRights(msg)) {
            msg.channel.send('The castle of Sycria Underwater Ruins.');
        }

        if (msg.content === '!complaints') {
            msg.delete(1000);
            msg.channel.send('Don\'t like the RSVP Bot spam?\nhttps://youtu.be/ynMk2EwRi4Q');
        }

    });

    client.login(atob(auth.token));

}