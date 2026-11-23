# Set up Telegram reports

Sending is optional. You can copy the report without a Telegram account or bot.

1. Open [@BotFather](https://t.me/BotFather), send `/newbot`, and follow the prompts. Save the token privately.
2. Open the bot's private chat, press **Start**, and send a message. For a group, add the bot, allow it to post, and send `/start@YourBotUsername` in that group.
3. Find the numeric chat ID in PowerShell 7. Enter the token at the prompt, not in the command:

   ```powershell
   $token = Read-Host 'Telegram bot token' -MaskInput
   try {
     (Invoke-RestMethod "https://api.telegram.org/bot$token/getUpdates").result |
       ForEach-Object { $_.message.chat } |
       Where-Object { $_ } |
       Select-Object id, type, title
   } finally {
     Remove-Variable token
   }
   ```

   Use the ID for the intended chat. Keep the minus sign for group IDs. If no chat appears, send a fresh message and retry. Use a dedicated bot if another app already consumes its updates or has a webhook configured.

4. In the project root, next to `package.json`, copy `.env.example` to `.env` if `.env` does not already exist. Set these values, replacing both placeholders:

   ```dotenv
   TELEGRAM_ENABLED=true
   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_CHAT_ID=your_numeric_chat_id
   ```

5. Restart the app with `npm.cmd run dev`. Open [Settings](http://127.0.0.1:5173/#settings) and confirm Telegram shows **Enabled**. Then open **Dashboard**, select your filters, and click **Send to Telegram**. Confirm the one-paragraph report arrived in the intended chat.

**Enabled** means the app accepted the configuration, not that Telegram verified delivery. If sending fails, check the token, chat ID, bot permissions, and backend internet access. Filters and CSV changes never send reports automatically.

Keep `.env` local. Do not commit it, share it, or include it in an archive. If you expose the token, revoke it through BotFather and update `.env` with the replacement.
