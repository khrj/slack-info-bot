const { App } = require('@slack/bolt')
const crypto = require("crypto")
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const app = new App({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    stateSecret: crypto.randomBytes(20).toString('hex'),
    scopes: ["chat:write", "chat:write.public", "commands"],
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

// Add features here

async function main() {
    await app.start(process.env.PORT || 3000)
    console.log('⚡️ Bolt app is running!')
}

main()