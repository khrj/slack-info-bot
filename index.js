const { App } = require('@slack/bolt')
const crypto = require("crypto")
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const app = new App({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    stateSecret: crypto.randomBytes(20).toString('hex'),
    scopes: ["chat:write", "chat:write.public", "commands", "channels:read", "usergroups:read", "users:read"],
    installerOptions: { installPath: '/' },
    installationStore: {
        storeInstallation: async (installation) => {
            await prisma.workspace.upsert({
                where: { id: installation.team.id },
                create: {
                    id: installation.team.id,
                    installation: JSON.stringify(installation)
                },
                update: {
                    installation: JSON.stringify(installation)
                }
            })
        },
        fetchInstallation: async (InstallQuery) => {
            const workspace = await prisma.workspace.findUnique({
                where: {
                    id: InstallQuery.teamId
                }
            })
            return JSON.parse(workspace.installation)
        },
    },
})

app.command('/info', async ({ ack, command, client }) => {
    ack()
    const user = command.text.match(/<@(.*)\|.*>/)
    const usergroup = command.text.match(/<\!subteam\^(.*)\|.*>/)
    const channel = command.text.match(/<#(.*)\|.*>/)

    let requestedInfo = []

    if (user) {
        const info = await client.users.info({
            user: user[1]
        })
        requestedInfo.push(
            ["ID", info.user.id],
            ["Username", info.user.name],
            ["Real name", info.user.real_name],
            ["Timezone", `${info.user.tz}, ${info.user.tz_label}`],
            ["Display name", info.user.profile.display_name],
            ["Permissions",
                (info.user.is_bot && "Bot") ||
                (info.user.is_app_user && "App") ||
                (info.user.is_ultra_restricted && "Single Channel Guest") ||
                (info.user.is_restricted && "Multi Channel Guest") ||
                (info.user.is_primary_owner && "Primary Workspace Owner") ||
                (info.user.is_owner && "Workspace Owner") ||
                (info.user.is_admin && "Workspace Admin") ||
                "Member"
            ]
        )
    } else if (usergroup) {
        const info = await client.usergroups.users.list({
            usergroup: usergroup[1]
        })

        requestedInfo.push(
            ["ID", usergroup[1]],
            ["Members", ""],
        )

        for (const user of info.users) {
            requestedInfo.push([`<@${user}>`, user])
        }
    } else if (channel) {
        const info = await client.conversations.info({
            channel: channel[1]
        })

        requestedInfo.push(
            ["ID", info.channel.id],
            ["Name", info.channel.name],
            ["Creator", `<@${info.channel.creator}>`],
            ["Topic", info.channel.topic.value],
            ["Description", info.channel.purpose.value],
            ["Previous Names", info.channel.previous_names.join(', ')]
        )
    } else {
        return client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: "Command parse error. Make sure you mention a @username, @usergroup, or #channel"
        })
    }

    let build = "Info:\n"

    for (const [key, value] of requestedInfo) {
        build += `\n • ${key}: ${value}`
    }

    await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: build,
    })
})

async function main() {
    await app.start(process.env.PORT || 3000)
    console.log('⚡️ Bolt app is running!')
}

main()