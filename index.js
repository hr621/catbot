// ✅ استدعاء المكتبات


require('dotenv').config();
const fs = require('fs');
const XLSX = require('xlsx');
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');

// 🧾 تحميل بيانات الدعوات من ملف التخزين
const DATA_FILE = './inviteRoleMap.json';
let inviteRoleMap = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    inviteRoleMap = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    inviteRoleMap = {};
  }
} else {
  fs.writeFileSync(DATA_FILE, JSON.stringify(inviteRoleMap, null, 2));
}

// 📘 تحميل أكواد الرول من ملف Excel
const EXCEL_FILE = './codes.xlsx';
let codeRoleMap = {};

function loadExcelCodes() {
  if (!fs.existsSync(EXCEL_FILE)) {
    console.warn('⚠️ ملف الأكواد غير موجود:', EXCEL_FILE);
    return;
  }
  const workbook = XLSX.readFile(EXCEL_FILE);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  codeRoleMap = {};
  for (const row of data) {
    if (row.Code && row.RoleID && row.GuildID) {
      codeRoleMap[String(row.Code).trim()] = {
        roleId: String(row.RoleID).trim(),
        guildId: String(row.GuildID).trim()
      };
    }
  }
  console.log(`📗 Loaded ${Object.keys(codeRoleMap).length} code-role mappings from Excel.`);
}

// تحميل الأكواد عند التشغيل + تحديث كل دقيقة
loadExcelCodes();
setInterval(loadExcelCodes, 60000);

// 🤖 إعداد البوت
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

const TOKEN = MTQzNTc5NjUzOTg3NTI2NjY3MA.G4wXN-.1tpoGG4Y_Q7GsibPN8CKVvPlxy9qng5XPNwy9Y;
const cachedInvites = new Map();

// 🔹 عند تشغيل البوت
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // تحميل الميمبرز لكل سيرفر وتحديثهم تلقائيًا
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      await guild.members.fetch();
      console.log(`👥 Loaded all members for guild: ${guild.name}`);

      // يحدث الميمبرز كل 5 دقائق
      setInterval(async () => {
        try {
          await guild.members.fetch();
          console.log(`🔄 Updated members cache for ${guild.name}`);
        } catch (err) {
          console.warn(`⚠️ Couldn't refresh members for ${guild.name}: ${err.message}`);
        }
      }, 30 *  1000);
    } catch (err) {
      console.warn(`⚠️ Couldn't fetch members for ${guild.name}: ${err.message}`);
    }
  }
});

// 🔹 لما عضو جديد يدخل السيرفر (نظام الدعوات)
client.on('guildMemberAdd', async (member) => {
  try {
    const guild = member.guild;
    const invites = await guild.invites.fetch();
    const oldMap = cachedInvites.get(guild.id) || new Map();

    let usedInvite = null;
    for (const invite of invites.values()) {
      const prevUses = oldMap.get(invite.code) ?? 0;
      if ((invite.uses ?? 0) > prevUses) {
        usedInvite = invite;
        break;
      }
    }

    const newMap = new Map();
    invites.forEach(inv => newMap.set(inv.code, inv.uses ?? 0));
    cachedInvites.set(guild.id, newMap);

    if (usedInvite) {
      const code = usedInvite.code;
      const mapping = inviteRoleMap[guild.id] || {};
      const roleId = mapping[code];
      if (roleId) {
        const role = guild.roles.cache.get(roleId);
        if (role) {
          const botMember = await guild.members.fetch(client.user.id);
          if (botMember.roles.highest.position > role.position) {
            await member.roles.add(role, `Assigned by invite ${code}`);
            console.log(`✅ ${member.user.tag} assigned role ${role.name} via invite ${code}`);
          }
        }
      }
    }
        // ✅ إرسال رسالة ترحيب في الخاص تطلب الكود
    try {
      await member.send(`👋 أهلاً بك في **${member.guild.name}**!\nمن فضلك أرسل لي الـ **CAT-ID** الخاص بك بالشكل \`000-000\` ل اعاطئك الرول الخاصه بك .`);
      console.log(`📨 Sent CAT-ID request to ${member.user.tag}`);
    } catch (err) {
      console.warn(`⚠️ لم أستطع إرسال رسالة خاصة إلى ${member.user.tag}.`);
    }

  } catch (err) {
    console.error('Error in guildMemberAdd:', err);
  }
});

// 🔹 استقبال الرسائل (سواء في السيرفر أو الخاص)
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // ✅ لو المستخدم أرسل رسالة في الخاص للبوت (DM)
  // ✅ لو المستخدم أرسل رسالة في الخاص للبوت (DM)
if (message.channel.type === 1 || message.channel.isDMBased()) {
  const code = message.content.trim();
  
  // ✅ يتحقق إن الكود بالشكل 000-000
  if (!/^\d{3}-\d{3}$/.test(code)) {
    return message.reply('❌ صيغة الكود غير صحيحة. استخدم الشكل: 000-000');
  }

  const entry = codeRoleMap[code];
  if (!entry) {
    return message.reply('❌ هذا الكود غير صحيح أو غير موجود.');
  }

  const { guildId, roleId } = entry;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return message.reply('⚠️ السيرفر المقابل لهذا الكود غير موجود أو البوت ليس فيه.');

  const member = await guild.members.fetch(message.author.id).catch(() => null);
  if (!member) return message.reply('⚠️ أنت لست عضوًا في السيرفر المطلوب.');

  const role = guild.roles.cache.get(roleId);
  if (!role) return message.reply('⚠️ الرول غير موجودة في السيرفر.');

  if (member.roles.cache.has(role.id))
    return message.reply('ℹ️ لديك هذا الرول بالفعل.');

  try {
    await member.roles.add(role, `Code redeem via DM: ${code}`);
    return message.reply(`✅ تم إعطاؤك الرول **${role.name}** داخل السيرفر **${guild.name}**.`);
  } catch (err) {
    console.error('❌ Error adding role via DM:', err);
    return message.reply('❌ حدث خطأ أثناء إضافة الرول. تأكد أن البوت عنده صلاحيات كافية.');
  }
}


  // ✅ رسائل داخل السيرفر (أوامر)
  if (!message.guild) return;
  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const [cmd, ...args] = message.content.slice(prefix.length).trim().split(/\s+/);

  // أمر checkrole
  if (cmd === 'checkrole') {
    const role = message.mentions.roles.first();
    if (!role) return message.reply('منشن الرول بعد الأمر: !checkrole @Role');
    return message.reply(`الرول ${role.name} فيها ${role.members.size} عضو.`);
  }

  // أمر mapinvite
  if (cmd === 'mapinvite') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild))
      return message.reply('❌ Need Manage Guild.');
    const inviteCode = args[0];
    const role = message.mentions.roles.first();
    if (!inviteCode || !role)
      return message.reply('❌ Usage: `!mapinvite <inviteCode> @Role`');
    if (!inviteRoleMap[message.guild.id]) inviteRoleMap[message.guild.id] = {};
    inviteRoleMap[message.guild.id][inviteCode] = role.id;
    fs.writeFileSync(DATA_FILE, JSON.stringify(inviteRoleMap, null, 2));
    return message.reply(`✅ Mapped invite \`${inviteCode}\` to role **${role.name}**`);
  }

  // أمر reloadcodes
  if (cmd === 'reloadcodes') {
    loadExcelCodes();
    return message.reply('✅ تم إعادة تحميل الأكواد من ملف Excel.');
  }
});

// 🔹 تشغيل البوت
client.login(TOKEN);


