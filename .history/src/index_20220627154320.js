const discord = require('discord.js');
const jsoning = require('jsoning');

const client = new discord.Client({intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILD_EMOJIS_AND_STICKERS', 'GUILD_MEMBERS', 'DIRECT_MESSAGE_REACTIONS', 'DIRECT_MESSAGE_TYPING', 'DIRECT_MESSAGES']});

const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { MessageEmbed } = require('discord.js');
const { Routes } = require('discord-api-types/v9');
const { token, clientId, guildId } = require('./config.json');
const roleIDs = {"announcer":"806664023101538344", "moderator":"792488887699636274"}
const channelIDs = {"moderator":"792490630982008852"}

const commands = [
    new SlashCommandBuilder()
        .setName('request')
        .setDescription('Request permission to post an announcement')
        .addStringOption(option =>
            option.setName('description')
            .setDescription('Describe what you will announce')
            .setRequired(true))
    // new SlashCommandBuilder()
    //     .setName('cancelrequest')
    //     .setDescription('Cancel a previously-made request')
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



client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;
    let channel = await fetchChannel(channelIDs.moderator);
    let desc = interaction.options.getString('description');
    let user = interaction.user;
    switch (interaction.commandName)
    {
        case 'request':
            await interaction.reply({content: `Permission has been requested, please wait...\n> \"${desc}\"`, ephemeral: true}).catch(console.error);
            const coolEmbed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle('Announcement Request')
                .setAuthor({name: user.username, iconURL: user.avatarURL(), })
                .setDescription(`\"${desc}\"`)
                .setTimestamp();
            let msg = await channel.send({embeds: [coolEmbed]}).catch(console.error);
            msg.react('✅').then(() => msg.react('❌')).catch(console.error);
            let endedOperation = false;
            const filter = (reaction, user) => ['✅', '❌'].includes(reaction.emoji.name) && !user.bot;
            // 900,000 secs = 15 mins
            msg.awaitReactions({filter, max: 1, time: 900000})
            .then(collected => {
                if (endedOperation) return;

                const reaction = collected.first();

                let resultEmbed = new MessageEmbed();
                msg.reactions.removeAll();
                switch (reaction.emoji.name)
                {
                    case '✅':
                        console.log("Yeah :)");
                        resultEmbed.setColor('#3dfc03')
                            .setTitle('Announcement Request')
                            .setAuthor({name: user.username, iconURL: user.avatarURL(), })
                            .setDescription(`\"${desc}\"\n\`This request was accepted.\``)
                            .setTimestamp(coolEmbed.timestamp);
                        break;
                    default:
                        console.log("No >:(");
                        resultEmbed.setColor('#f70c0c')
                        .setTitle('Announcement Request')
                        .setAuthor({name: user.username, iconURL: user.avatarURL(), })
                        .setDescription(`\"${desc}\"\n\`This request was denied.\``)
                        .setTimestamp(coolEmbed.timestamp);
                }
                msg.edit({embeds: [resultEmbed]}).catch(console.error);
            }).catch(collected => {
                if (endedOperation) return;
                msg.reactions.removeAll();
                const notCoolEmbed = new MessageEmbed()
                    .setColor('#757575')
                    .setTitle('Announcement Request')
                    .setAuthor({name: user.username, iconURL: user.avatarURL(), })
                    .setDescription(`\"${desc}\"\n\`This request has expired.\``)
                    .setTimestamp(coolEmbed.timestamp);
                msg.edit({embeds: [notCoolEmbed]}).catch(console.error);
            })
            break;
    }
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