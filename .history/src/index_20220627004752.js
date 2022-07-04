const discord = require('discord.js');
const jsoning = require('jsoning');

const client = new discord.Client({intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILD_EMOJIS_AND_STICKERS', 'GUILD_MEMBERS', 'DIRECT_MESSAGE_REACTIONS', 'DIRECT_MESSAGE_TYPING', 'DIRECT_MESSAGES']});

const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { token, clientId, guildId } = require('./data/config.json');
const roleIDs = {"announcer":806664023101538344, "moderator":792488887699636274}

const commands = [
    new SlashCommandBuilder()
        .setName('request')
        .setDescription('Request permission to post an announcement'),
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

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;
    const channelID = interaction.channelId;
    let channel = interaction.channel;
    const announcerRole = fetchRole(roles.announcer);
    switch (interaction.commandName)
    {
        case 'srs':
            await interaction.reply('Understood. Bots disabled in this channel.').catch(console.error);
            setPerms(channel,announcerRole,false,'Disabling bots')
            .then(updated => console.log('Fuck you bots lmao'))
            .catch(console.error);
            seriousChannels.set(channelID, true);
            break;
    }
});

async function fetchRole(id)
{
    return await interaction.guild.roles.cache.find(r => r.id === id)
}