const discord = require('discord.js');
const jsoning = require('jsoning');

const client = new discord.Client({intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILD_EMOJIS_AND_STICKERS', 'GUILD_MEMBERS', 'DIRECT_MESSAGE_REACTIONS', 'DIRECT_MESSAGE_TYPING', 'DIRECT_MESSAGES']});

const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { MessageEmbed } = require('discord.js');
const { Routes } = require('discord-api-types/v9');
const { token, clientId, guildId } = require('./data/config.json');
const { roleIDs, channelIDs, embedStyles, voteEmojiData, cooldownHours } = require('./data/botData.json');
const modCooldowns = new jsoning('modcooldowns.json');

const commands = [
    new SlashCommandBuilder()
        .setName('request')
        .setDescription('Request permission to post an announcement')
        .addStringOption(option =>
            option.setName('description')
            .setDescription('Describe what you will announce. ATTACHMENTS ARE NOT ACCEPTED, SIMPLY DESCRIBE WHAT YOU WILL POST!!')
            .setRequired(true)),
    new SlashCommandBuilder()
        .setName('cancelrequest')
        .setDescription('Cancel a previously-made request')
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
})();

let usersRequested = {};
let cooldowns = {};

function truncateFloat(num, precision)
{
    return Math.floor(num * Math.pow(10, precision)) / Math.pow(10, precision);
}

function setEmbedStyle(embed, user, reactor, desc, style, reaction)
{
    let styleData = embedStyles[style];
    let resultText = styleData.resultText;
    if (user != null)
        resultText = resultText.replace('{username}', user.username);
    if (reactor != null)
        resultText = resultText.replace('{reactorname}', reactor.username);
    if (reaction != null)
    {
        let allreactors = "";
        let rawlist = reaction.users.cache;
        let coollist = [];
        rawlist.forEach(guy => {
            if (!guy.bot)
                coollist.push(guy);
        });
        for (let i = 0; i < coollist.length; i++) {
            const element = coollist[i];
            allreactors += element.username;
            if (i + 1 < coollist.length)
            {
                if (coollist.length != 2)
                    allreactors += ", ";
                else
                    allreactors += " "

                if (i + 1 == coollist.length - 1)
                    allreactors += "and ";
            }
        }
        resultText = resultText.replace('{allreactors}', allreactors);
    }
    embed.setColor(styleData.color)
        .setTitle('Announcement Request')
        .setAuthor({name: user.username, iconURL: user.avatarURL()})
        .setDescription(`\"${desc}\"\n\n\`${resultText}\``)
        .setTimestamp(Date.now());
}

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;
    let channel = await fetchChannel(channelIDs.ticketChannel);
    let desc = interaction.options.getString('description');
    let user = interaction.user;
    let member = interaction.member;
    switch (interaction.commandName)
    {
        case 'request':
            if (user.id in usersRequested)
            {
                await interaction.reply({content: `You already requested permission! You can cancel your previous request by typing /cancelrequest.`, ephemeral: true}).catch(console.error);
                break;
            }
            if (user.id in cooldowns)
            {
                let timeElapsed = (Date.now() - cooldowns[user.id]['startTime']) / 1000;
                console.log(`${timeElapsed} > ${cooldowns[user.id]['banTime']}?`);
                if (timeElapsed < cooldowns[user.id]['banTime'])
                {
                    let timeLeft = cooldowns[user.id]['banTime'] - timeElapsed;
                    let text = "seconds";
                    if (timeLeft > 60)
                    {
                        timeLeft /= 60;
                        text = "minutes"
                    }
                    await interaction.reply({content: `You are still banned from requesting tickets. Wait ${truncateFloat(timeLeft, 1)} ${text}.`, ephemeral: true}).catch(console.error);
                    break;
                }
                delete cooldowns[user.id];
            }
            let endedOperation = false;
            let timestamp = Date.now()
            usersRequested[user.id] = {timestamp: timestamp};
            await interaction.reply({content: `Permission has been requested, please wait... (type /cancelrequest to cancel)\n> \"${desc}\"`, ephemeral: true}).catch(console.error);
            const coolEmbed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle('Announcement Request')
                .setAuthor({name: user.username, iconURL: user.avatarURL()})
                .setDescription(`\"${desc}\"`)
                .setTimestamp(timestamp);
            let msg = await channel.send({embeds: [coolEmbed]}).catch(console.error);
            if (voteEmojis.accept == null)
            {
                for (const action in voteEmojiData) {
                    if (Object.hasOwnProperty.call(voteEmojiData, action)) {
                        const emojiData = voteEmojiData[action];
                        voteEmojis[action] = emojiData.custom ? client.emojis.cache.find(emoji => emoji.name === emojiData.name) : emojiData.name;
                        console.log(`Setting ${action} to ${voteEmojis[action]}`);
                    }
                }
            }
            let names = [];
            Object.values(voteEmojiData).forEach(data => {
                names.push(data.name);
            });
            msg.react(voteEmojis.accept).then(() => msg.react(voteEmojis.decline).then(() => msg.react(voteEmojis.forceAccept).then(() => msg.react(voteEmojis.ban)))).catch(console.error);
            const filter = (reaction, user) => names.includes(reaction.emoji.name) && !user.bot;

            let banTime = 600;

            var penis = async function(action, reactor, reaction)
            {
                let resultEmbed = new MessageEmbed();
                msg.reactions.removeAll();
                switch (action)
                {
                    case "Force Accept":
                    case "Accept":
                        console.log("Yeah :)");
                        setEmbedStyle(resultEmbed, user, reactor, desc, `${action === "Force Accept" ? "force" : ""}approved`, reaction);
                        user.send(`Your request to announce \"${desc}\" has been approved!`);
                        let announceRole = await fetchRole(member.guild, roleIDs.announcer);
                        member.roles.add(announceRole);
                        if (action === "Force Accept")
                            modCooldowns.set(reactor.id, Date.now());
                        break;
                    case 'Ban':
                        console.log('stfu >>:((');
                        setEmbedStyle(resultEmbed, user, reactor, desc, "banned", reaction);
                        user.send(`Your request was fucking stupid and you are unable to request for ${banTime / 60} minutes because of it. #ripbozo`);
                        cooldowns[user.id] = {startTime: Date.now(), banTime: banTime};
                        break;
                    default:
                        console.log("No >:(");
                        setEmbedStyle(resultEmbed, user, reactor, desc, "denied", reaction);
                        user.send(`Your request to announce \"${desc}\" was denied. If you wanted to respond to an announcement, just discuss it in another chat.`);
                }
                delete usersRequested[user.id];
                msg.edit({embeds: [resultEmbed]}).catch(console.error);
            }

            // 1,200,000 ms = 20 mins
            const collector = msg.createReactionCollector({ filter, time: 1200000 });

            collector.on('collect', async (reaction, reactor) => {
                if (endedOperation) return;

                let reactionCount = reaction.count - 1;

                let votesRequired = 3 - Math.min(Math.floor((Date.now() - timestamp) / 60000 / 5), 2);

                if (!([voteEmojiData.accept.name, voteEmojiData.decline.name, voteEmojiData.ban.name].includes(reaction.emoji.name) && reactionCount >= votesRequired) && reaction.emoji.name != voteEmojiData.forceAccept.name)
                    return;

                let forceAccepted = reaction.emoji.name === voteEmojiData.forceAccept.name;

                if (modCooldowns.has(reactor.id) && Date.now() - modCooldowns.get(reactor.id) <= cooldownHours * 60 * 60 * 1000 && forceAccepted)
                {
                    let txt = "seconds";
                    let time = (cooldownHours * 60 * 60 * 1000 - (Date.now() - modCooldowns.get(reactor.id))) / 1000;
                    if (time / 60 >= 1)
                    {
                        txt = "minutes";
                        time /= 60;
                        if (time / 60 >= 1)
                        {
                            txt = "hours";
                            time /= 60;
                        }
                    }
                    reactor.send(`You cannot force accept a request for another ${truncateFloat(time, 1)} ${txt}!`);
                    //reaction.users.remove(reactor);
                    return;
                }

                switch (reaction.emoji.name)
                {
                    case voteEmojiData.forceAccept.name:
                    case voteEmojiData.accept.name:
                        penis(forceAccepted ? "Force Accept" : "Accept", reactor, reaction);
                        break;
                    case voteEmojiData.ban.name:
                        penis("Ban", reactor, reaction);
                        break;
                    default:
                        penis("eoawsgfaseiufgewiufg ew", reactor, reaction);
                }
                endedOperation = true;
                collector.stop();
            });

            collector.on('end', collected => {
                if (endedOperation || !(user.id in usersRequested)) return;
                delete usersRequested[user.id];
                let col = Array.from(collected.values());
                let allSameVal = true;
                let mostReactions = null;
                let prev = null;
                col.forEach(reaction => {
                    if (reaction.emoji.name != voteEmojiData.forceAccept.name)
                    {
                        if (prev != null && prev.count != reaction.count)
                            allSameVal = false;
                        if (mostReactions == null || reaction.count > mostReactions.count)
                            mostReactions = reaction;
                        prev = reaction;
                    }
                });
                if (col.length === 1)
                {
                    allSameVal = false;
                    mostReactions = col[0];
                }
                msg.reactions.removeAll();
                if (allSameVal)
                {
                    const notCoolEmbed = new MessageEmbed()
                    setEmbedStyle(notCoolEmbed, user, null, desc, "expired");
                    msg.edit({embeds: [notCoolEmbed]}).catch(console.error);
                }
                else
                {
                    switch (mostReactions.emoji.name)
                    {
                        case voteEmojiData.forceAccept.name:
                        case voteEmojiData.accept.name:
                            penis(mostReactions.emoji.name === voteEmojiData.forceAccept.name ? "Force Accept" : "Accept", null, mostReactions);
                            break;
                        case voteEmojiData.ban.name:
                            penis("Ban", null, mostReactions);
                            break;
                        default:
                            penis("eoawsgfaseiufgewiufg ew", null, mostReactions);
                    }
                }
            });

            usersRequested[user.id]['cancel'] = () => {
                endedOperation = true;
                msg.reactions.removeAll();
                const cancelledEmbed = new MessageEmbed()
                setEmbedStyle(cancelledEmbed, user, null, desc, "cancelled");
                msg.edit({embeds: [cancelledEmbed]}).catch(console.error);
            }
            break;
        case 'cancelrequest':
            if (!(user.id in usersRequested))
            {
                await interaction.reply({content: 'You don\'t have a pending request!', ephemeral: true}).catch(console.error);
                break;
            }
            let timeDifference = Date.now() - usersRequested[user.id]['timestamp'];
            console.log(Date.now() - usersRequested[user.id]['timestamp'])
            if (timeDifference < 10000)
            {
                await interaction.reply({content: `You must wait at least ${Math.floor((10 - ((timeDifference + Number.MIN_VALUE) / 1000)) * 10) / 10} more seconds before cancelling your request.`, ephemeral: true}).catch(console.error);
                break;
            }
            usersRequested[user.id]['cancel']();
            delete usersRequested[user.id];
            await interaction.reply({content: `Your request has been cancelled.`, ephemeral: true}).catch(console.error);
    }
});

client.on('messageCreate', async message =>{
    if (message.channelId != channelIDs.announcements) return;
    let announcerRole = await fetchRole(message.guild, roleIDs.announcer)
    console.log(`No more announcer for ${message.member.user.username}`);
    message.member.roles.remove(announcerRole).catch(console.error);
});

async function fetchRole(guild, id)
{
    return await guild.roles.cache.find(r => r.id === id);
}

async function fetchChannel(id)
{
    return await client.channels.cache.get(id);
}

var voteEmojis = {
    "accept":null,
    "decline":null,
    "forceAccept":null,
    "ban":null
}

client.once('ready', async () => {
    client.user.setActivity("Type /request");
});

client.once('error', () => {
    console.log('FUCK');
});

client.login(token);