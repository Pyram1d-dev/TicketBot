const discord = require('discord.js');
const jsoning = require('jsoning');

const client = new discord.Client({intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILD_EMOJIS_AND_STICKERS', 'GUILD_MEMBERS', 'DIRECT_MESSAGE_REACTIONS', 'DIRECT_MESSAGE_TYPING', 'DIRECT_MESSAGES']});

const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { MessageEmbed } = require('discord.js');
const { Routes } = require('discord-api-types/v9');
const { token, clientId, guildId, roleIDs, channelIDs } = require('./config.json');

const commands = [
    new SlashCommandBuilder()
        .setName('request')
        .setDescription('Request permission to post an announcement')
        .addStringOption(option =>
            option.setName('description')
            .setDescription('Describe what you will announce')
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
            let endedOperation = false;
            let timestamp = Date.now()
            usersRequested[user.id] = {timestamp: timestamp};
            await interaction.reply({content: `Permission has been requested, please wait...\n> \"${desc}\"`, ephemeral: true}).catch(console.error);
            const coolEmbed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle('Announcement Request')
                .setAuthor({name: user.username, iconURL: user.avatarURL(), })
                .setDescription(`\"${desc}\"`)
                .setTimestamp(timestamp);
            let msg = await channel.send({embeds: [coolEmbed]}).catch(console.error);
            
            let stud = client.emojis.cache.find(emoji => emoji.name === "gamerstud");
            let youshould = client.emojis.cache.find(emoji => emoji.name === "youshould");
            msg.react('✅').then(() => msg.react('❌').then(() => msg.react(stud))).catch(console.error);
            const filter = (reaction, user) => ['✅', '❌', 'gamerstud', 'youshould'].includes(reaction.emoji.name) && !user.bot;
            // 1,200,000 ms = 20 mins

            const collector = msg.createReactionCollector({ filter, time: 1200000 });

            collector.on('collect', async (reaction, reactor) => {
                if (endedOperation) return;

                console.log("Collecting " + reaction.emoji.name + " from " + reactor.username);

                let reactionCount = reaction.count - 1;

                if (!(['✅', '❌', 'youshould'].includes(reaction.emoji.name) && reactionCount >= 3) && reaction.emoji.name != 'gamerstud')
                {
                    console.log(`Cancelling! ${reactionCount} users reacted with ${reaction.emoji.name}.`);
                    return;
                }

                let resultEmbed = new MessageEmbed();
                msg.reactions.removeAll();
                switch (reaction.emoji.name)
                {
                    case 'gamerstud':
                    case '✅':
                        console.log("Yeah :)");
                        let forceAccepted = reaction.emoji.name === 'gamerstud';

                        resultEmbed.setColor('#3dfc03')
                            .setTitle('Announcement Request')
                            .setAuthor({name: user.username, iconURL: user.avatarURL(), })
                            .setDescription(`\"${desc}\"\n\n\`This request was${forceAccepted ? " force" : ""} accepted${forceAccepted ? ` by ${reactor.username}` : ""}.\``)
                            .setTimestamp(timestamp);

                        user.send(`Your request to announce \"${desc}\" has been approved!`);
                        let announceRole = await fetchRole(member.guild, roleIDs.announcer);
                        member.roles.add(announceRole);
                        break;
                    default:
                        console.log("No >:(");

                        resultEmbed.setColor('#f70c0c')
                            .setTitle('Announcement Request')
                            .setAuthor({name: user.username, iconURL: user.avatarURL(), })
                            .setDescription(`\"${desc}\"\n\n\`This request was denied.\``)
                            .setTimestamp(timestamp);

                        user.send(`Your request to announce \"${desc}\" was denied.`);
                }
                endedOperation = true;
                delete usersRequested[user.id];
                msg.edit({embeds: [resultEmbed]}).catch(console.error);
            });

            collector.on('end', collected => {
                if (endedOperation) return;
                delete usersRequested[user.id];
                msg.reactions.removeAll();
                const notCoolEmbed = new MessageEmbed()
                    .setColor('#757575')
                    .setTitle('Announcement Request')
                    .setAuthor({name: user.username, iconURL: user.avatarURL(), })
                    .setDescription(`\"${desc}\"\n\n\`This request has expired.\``)
                    .setTimestamp(timestamp);
                msg.edit({embeds: [notCoolEmbed]}).catch(console.error);
            });

            usersRequested[user.id]['cancel'] = () => {
                endedOperation = true;
                msg.reactions.removeAll();
                const cancelledEmbed = new MessageEmbed()
                    .setColor('#757575')
                    .setTitle('Announcement Request')
                    .setAuthor({name: user.username, iconURL: user.avatarURL(), })
                    .setDescription(`\"${desc}\"\n\n\`This request was cancelled by the user.\``)
                    .setTimestamp(timestamp);
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

client.once('ready', async () => {
    console.log('Awesome');
});

client.once('error', () => {
    console.log('FUCK');
});

client.login(token);