var auth = require('./auth.json');
const Discord = require('discord.js');
var atob = require('atob');
var schedule = require('node-schedule');
const fs = require('fs');
var gsjson = require('google-spreadsheet-to-json');
var creds = require('./google-generated-creds.json');
const db = require('./db_helper');


class scheduler_helper {
    constructor() {
        this.db_helper = db();
        this.client = new Discord.Client();
    }

    db_helper;

    setting;

    sheet;
    settings_workSheet;

    siegeMember;

    me;
    client;

    event_google_sheet = "0";

    delay = 500;

    readFile = (path) => {
        var rawdata = fs.readFileSync(path);
        var obj = JSON.parse(rawdata);
        return obj;
    }

    init = (settings) => {
        return new Promise((resolve) => {
            this.setting = null;
            console.log(this.setting ? this.setting.ID : 'Unassigned' + ' BEFORE VS ' + settings.ID);
            this.setting = settings;
            console.log(this.setting.ID + ' VS ' + settings.ID);
            this.siegeMember = "<@&" + settings.Event_Role_ID + ">";
            this.me = "<@" + settings.Developer_ID + ">";
            delete this.client;
            this.client = settings.dis_client;


            this.db_helper.configuration_first_row(settings.ID).then((cRow) => {
                this.sheet = cRow.Sheet;
                this.settings_workSheet = cRow.Settings_WorkSheet;
                //setTimeout if needed
                resolve(true);
            })
        })
    }


    writeFile = (obj, path) => {
        let data = JSON.stringify(obj);
        fs.writeFileSync(path, data);
    }

    readSettings = (work_Sheet) => {
        var credentials = atob(creds.json);

        let prom = gsjson({
            spreadsheetId: this.sheet,
            credentials: credentials,
            worksheet: work_Sheet
            // other options...
        });

        //prom.then((obj) => { console.log(obj) });
        return prom;
    }

    sendForms = () => {
        this.readSettings(this.settings_workSheet).then((ws) => {
            var workS = ws[0];
            this.client.channels.get(this.setting.Announcement_Channel_ID).send(this.siegeMember + ' Forms for the week have been updated on ' + workS.updated + ', and here they are! \n' + workS.g_forms_link);
        })
            .catch(() => {
            });
    }


    schedulerController = (rule, control) => {
        console.log('SCHEDULER', this.setting.ID, 'control : ' + control);
       schedule.scheduleJob(rule, () => {
            if (control && control === 'initial') {
                this.sendForms();
            }
            if (control && control === 'vacation') {
                this.get_non_attendance(null, control);
            }
            else {
                this.get_attendance(null, control);
            }
        });

    }

    schedulerProcess = (dayOfWeek, hour, minute, control) => {
        var rule = new schedule.RecurrenceRule();
        rule.dayOfWeek = dayOfWeek;
        rule.hour = hour;
        rule.minute = minute;
        this.schedulerController(rule, control);
    }

    scheduler = (settings) => {
        this.init(settings).then(() => {
            console.log('SCHEDULER EVENT ID : ', this.setting.ID);
            this.db_helper.schedule_all_rows(this.setting.ID).then((sRows) => {
                sRows.forEach((sRow) => {
                    this.schedulerProcess(sRow.DayOfWeek, sRow.Hour, sRow.Minute, sRow.Control);
                })
                console.log(`Setup complete for ${this.client.user.tag} on G_ID : ${this.setting.guildID} & E_ID : ${this.setting.ID}`);
            })
        })
    }

    checkAdminRights = (msg) => {
        return new Promise((resolve) => {
            this.db_helper.permissions_all_rows(this.setting.ID).then((perRows) => {

                var right = msg.member.roles.some(role =>
                    perRows.some((perRow) => role.name.includes(perRow.Role))
                );

                if (!right) {
                    msg.delete(1000);
                    msg.reply("Sorry you dont have permission to use this :(");
                }

                resolve(right);
            })
        })
    }


    getDiscordGuildies = (discordGuildMembers, completed) => {

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


    getGoogleSheet = (msg) => {

        return new Promise((resolve) => {

            this.readSettings(this.event_google_sheet).then((completed) => {
                resolve(completed);
            }).catch((err) => {
                console.log(err);
                resolve(err);
                if (msg) {
                    msg.channel.send('Sorry not able to read sheet! ' + this.me + ' please help!');
                }
                else {
                    this.client.channels.get(this.setting.Announcement_Channel_ID).send('Sorry not able to read sheet! ' + this.me + ' please help!');
                }
            });
        })
    }

    filterAttendance = () => {
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



    get_non_attendance = (msg) => {

        this.getGoogleSheet(msg).then((completed) => {
            var discordGuildMembers = this.client.guilds.get(this.setting.guild_Discord_ID).roles.find("id", this.setting.Event_Role_ID).members;

            var non_attendees = completed.filter((complete) => {
                var property = Object.keys(complete).filter((key) => key.toLowerCase().startsWith('areyouabletojoinsiegewar'));
                return complete[property] == 'No';
            })

            var discordNonAttendees = this.getDiscordGuildies(discordGuildMembers, non_attendees);

            console.log('Non Attendees : ', discordNonAttendees);

            var discordNonAttendeeMembers = discordNonAttendees.map((user) => {
                return '<@' + user.user.id + '>';
            });

            var spammer = discordNonAttendeeMembers.join('\n');

            this.readSettings().then((ws) => {
                var workS = ws[0];

                var spamMessage = 'Thank you for filling RSVP ' + workS.updated + ' for the week!\n' +
                    'Please be reminded to set your vacation status to [Yes] before siege!' + '\n' + spammer +
                    '\nAny issues please inform ' + this.me;

                console.log('Message : ' + spamMessage);

                if (msg) {
                    msg.delete(this.delay);
                    msg.channel.send('Vacation reminder will be sent shortly :)');
                }
                this.client.channels.get(this.setting.Announcement_Channel_ID).send(spamMessage);
            })
                .catch(() => {

                });
        })

    }


    get_astray = (msg) => {
        this.getGoogleSheet(msg).then((completed) => {
            var discordGuildMembers = this.client.guilds.get(this.setting.guild_Discord_ID).roles.find("id", this.setting.Event_Role_ID).members;

            var discordCompletedMembers = this.getDiscordGuildies(discordGuildMembers, completed);

            var discordUncompletedMembers_raw = discordGuildMembers.filter((member) => {
                var ind = discordCompletedMembers.findIndex(complete => {
                    var userName = member && member.user.username ? member.user.username : '';
                    return complete.username === userName;
                });
                return ind === -1 ? true : false;
            });

            var discordUncompletedMembers = discordUncompletedMembers_raw.map((user) => {
                return '<@' + user.user.id + '>';
            });

            var spammer = discordUncompletedMembers.join('\n');

            var spamMessage = 'Unfortunately the below list of members have yet to fill RSVP!' + '\n' + spammer;

            console.log('Message : ' + spamMessage);
            msg.delete(this.delay);
            msg.author.send(spamMessage);
        })
    }



    get_attendance = (msg, control) => {
        this.getGoogleSheet(msg).then((completed) => {
            var discordGuildMembers = this.client.guilds.get(this.setting.guild_Discord_ID).roles.find("id", this.setting.Event_Role_ID).members;

            var discordCompletedMembers = this.getDiscordGuildies(discordGuildMembers, completed);

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

            this.readSettings(this.settings_workSheet).then((ws) => {
                var workS = ws[0];

                var spamMessage =
                    control && control == 'warning' ?
                        'Unfortunately the below list of members have failed to fill up RSVP for the week (' + workS.updated + ')  :(\n' +
                        spammer + '\nIf you have already filled the form but still see your name here inform ' + this.me :
                        'Please fill up the document/s prepared on ' + workS.updated + ' for the week!\n' +
                        workS.g_forms_link + '\n' + spammer + '\nIf you have already filled the document but still see your name here inform ' + this.me;

                console.log('Message : ' + spamMessage);

                if (msg) {
                    msg.delete(1000);
                    msg.channel.send(control && control == 'warning' ? 'Warnings to be issued :\'(' : 'Announcements will be updated shortly :)');
                }
                this.client.channels.get(this.setting.Announcement_Channel_ID).send(spamMessage);
            })
                .catch(() => {

                });
        })
    }

    specMessages = (msg) => {

        return new Promise((resolve) => {

            this.db_helper.guild_event_first_row({
                a: msg.guild.id,
                b: msg.channel.id
            }).then((geRow) => {

                let settings = {
                    ID: geRow.EventID,
                    Announcement_Channel_ID: geRow.Announcement_Channel_ID,
                    Event_Role_ID: geRow.Event_Role_ID,
                    Guild_ID: geRow.Guild_ID,
                    guildID: geRow.ID,
                    guild_Discord_ID: geRow.Discord_ID,
                    Developer_ID: geRow.Developer_ID,
                    dis_client: this.client
                }

                this.init(settings).then((res) => {
                    resolve(res);
                })
            })
        })
    }
}

var mainFunct = () => {
    this.setupScheduler = (settings) => {
        let sh = new scheduler_helper();
        sh.scheduler(settings);
    }


    this.messageHandler = (msg) => {

        let sh = new scheduler_helper();

        if (msg.content === '!best_sea_guild?') {
            msg.channel.send('The highest leveled player in SEA is in?...');
        }

        if (msg.content === '!worst_sea_guild?') {
            msg.channel.send('The lowest leveled player in SEA is -   \nnah the ones who lack a spine, even more so than the backbone of a fossilized snail.');
        }

        if (msg.content === '!best_castle?') {
            msg.channel.send('The castle of Sycria Underwater Ruins.');
        }

        if (msg.content === '!complaints') {
            msg.delete(sh.delay);
            msg.channel.send('Don\'t like the RSVP Bot spam?\nhttps://youtu.be/ynMk2EwRi4Q');
        }

        if (msg.content === '!tell_time') {
            var datetime = (new Date()).toLocaleString();
            msg.delete(sh.delay);
            msg.channel.send(datetime);
        }

        if (msg.content === '!rsvp_help') {
            sh.specMessages(msg).then(() => {
                sh.checkAdminRights(msg).then((right) => {
                    if (right) {
                        var guide = "Tell current time : \n!tell_time" +
                            "\n2)Send Announcements : \n!send_announcements" +
                            "\n3)Send Reminder : \n!remind_members" +
                            "\n4)Warn Members : \n!warn_members" +
                            "\n5)Remind Vacationers : \n!send_vacation";
                        msg.delete(sh.delay);
                        msg.channel.send(guide);
                    }
                })
            })
        }


        if (msg.content === '!send_announcements') {
            sh.specMessages(msg).then(() => {
                sh.checkAdminRights(msg).then(() => {
                    msg.delete(sh.delay);
                    sh.sendForms();
                })
            })
        }

        if (msg.content === '!remind_members') {
            sh.specMessages(msg).then(() => {
                sh.checkAdminRights(msg).then(() => {
                    sh.get_attendance(msg);
                })
            })
        }

        if (msg.content === '!warn_members') {
            sh.specMessages(msg).then(() => {
                sh.checkAdminRights(msg).then(() => {
                    sh.get_attendance(msg, 'warning');
                })
            })
        }

        if (msg.content === '!send_vacation') {

            sh.specMessages(msg).then(() => {
                sh.checkAdminRights(msg).then(() => {
                    sh.get_non_attendance(msg);
                })
            })
        }

        if (msg.content === '!read_settings') {
            sh.specMessages(msg).then(() => {
                sh.checkAdminRights(msg).then(() => {
                    sh.readSettings(sh.settings_workSheet).then((ws) => {
                        msg.author.send("LINK : " + (ws[0] && ws[0].g_forms_link ? ws[0].g_forms_link : '') + "\n" +
                            "Updated : " + (ws[0] && ws[0].updated ? ws[0].updated : ''));
                        msg.delete(sh.delay);
                    });
                })
            })
        }

        if (msg.content === '!check_attendance') {
            sh.specMessages(msg).then(() => {
                sh.checkAdminRights(msg).then(() => {
                    sh.get_astray(msg);
                })
            })
        }

    }

    return this;
}

// eslint-disable-next-line no-undef
module.exports = mainFunct;