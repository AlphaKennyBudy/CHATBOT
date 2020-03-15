require("dotenv").config();
let db = require("./database.js");
const TelegramBot = require("node-telegram-bot-api");
const debug = require("./helpers");
const keyboards = require("./keyboards");
const kb = require("./keyboard_buttons");

const TOKEN = process.env.TOKEN;

const bot = new TelegramBot(TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

console.log("Бот успешно запущен!");

bot.on("message", msg => {
  const chatId = msg.chat.id;

  const close_txt = "Закрыть ❌";
  const option_txt = "Настройки ⚙️";
  const validation_txt = "Я могу быть заражен?🤧\nПроверить себя";

  const user_id = msg.from.id;
  const chat_id = msg.chat.id;
  let {
    first_name,
    username
  } = msg.from;
  const date = msg.date;
  let userRef = db.collection("user_info").doc(String(user_id));
  let news_notification = true;
  let pharmacy_notification = true;

  switch (msg.text) {
    case "/start":
      bot.sendMessage(
        chatId,
        "Здравствуйте! Я бот, который поможет вам узнавать всю актульную информацию о COVID-19\nВсе уведомления по умолчанию включены.", {
          reply_markup: {
            inline_keyboard: [
              [{
                text: "Выключить новости",
                callback_data: "news_notification_false"
              }],
              [{
                text: "Выключить уведомления\nо повышении цен в аптеках",
                callback_data: "pharmacy_notification_false"
              }]
            ]
          }
        }
      );

      if (username === undefined) {
        username = null;
      }

      // bot.sendMessage(chatId, debug(msg));

      userRef
        .get()
        .then(snapshot => {
          if (!snapshot.exists) {
            userRef
              .set({
                user_id: user_id,
                chat_id: chat_id,
                first_name: first_name,
                username: username,
                date: new Date(date),
                news_notification: true,
                pharmacy_notification: true
              })
              .then(() => {
                console.log("User successfully added!");
              });
          } else {
            console.log("Already in database");
          }
        })
        .catch(err => {
          console.error(err);
        });
      break;
    case close_txt:
      bot.sendMessage(chatId, "Закрыто", {
        reply_markup: {
          remove_keyboard: true
        }
      });
      break;
    case "/test":
    case validation_txt:
      bot.sendMessage(chatId, 'Начинаем диагностику...\nОтвечайте на вопросы только ответами, приведенными ниже\nЕсли вашего ответа нет, отвечайте "Нет"\nУ вас есть лихорадка?', {
        reply_markup: {
          inline_keyboard: keyboards.q1A
        }
      });
      break;
    case "/options":
    case option_txt:
      // Получить инфу с дб о нотификациях
      // и в зависимости от этого делать дальше
      userRef.get().then(snapshot => {
        if (snapshot.exists) {
          news_notification = snapshot.data().news_notification;
          pharmacy_notification = snapshot.data().pharmacy_notification;
        }
      });
      let news_notification_option = [];
      let pharmacy_notification_option = [];

      console.log(news_notification);
      console.log(pharmacy_notification);

      if (news_notification) {
        news_notification_option = [{
          text: "Выключить новости",
          callback_data: "news_notification_false"
        }];
      } else {
        news_notification_option = [{
          text: "Включить новости",
          callback_data: "news_notification_true"
        }];
      }

      if (pharmacy_notification) {
        pharmacy_notification_option = [{
          text: "Выключить уведомления nо повышении цен в аптеках",
          callback_data: "pharmacy_notification_false"
        }];
      } else {
        pharmacy_notification_option = [{
          text: "Включить уведомления nо повышении цен в аптеках",
          callback_data: "pharmacy_notification_true"
        }];
      }
      bot.sendMessage(chatId, 'Настройки', {
        reply_markup: {
          inline_keyboard: [
            news_notification_option,
            pharmacy_notification_option
          ]
        }
      });
      break;
    case "/menu":
    default:
      bot.sendMessage(chatId, "Выберите действие", {
        reply_markup: {
          keyboard: [
            [validation_txt],
            [option_txt],
            [close_txt]
          ],
          one_time_keyboard: true
        }
      });
  }
});

bot.on("callback_query", query => {
  const userId = query.from.id;
  const chatId = query.message.chat.id;

  userRef = db.collection("user_info").doc(String(userId));

  switch (query.data) {
    case "news_notification_false":
      // set to false
      userRef
        .update({
          news_notification: false
        })
        .then(() => {
          console.log("News notification option updated to false");
        })
        .catch(error => {
          console.error(error);
        });

      bot.sendMessage(chatId, "Уведомления о новостях выключены");
      break;
    case "pharmacy_notification_false":
      // set to false
      userRef
        .update({
          pharmacy_notification: false
        })
        .then(() => {
          console.log("Pharmacy notification option updated to false");
        })
        .catch(error => {
          console.error(error);
        });

      bot.sendMessage(
        chatId,
        "Уведомления о повышении цен в аптеках выключены"
      );
      break;
    case "news_notification_true":
      // set to true
      userRef
        .update({
          news_notification: true
        })
        .then(() => {
          console.log("News notification option updated to true");
        })
        .catch(error => {
          console.error(error);
        });

      bot.sendMessage(chatId, "Уведомления о новостях включены");
      break;
    case "pharmacy_notification_true":
      // set to true
      userRef
        .update({
          pharmacy_notification: true
        })
        .then(() => {
          console.log("Pharmacy notification option updated to true");
        })
        .catch(error => {
          console.error(error);
        });

      bot.sendMessage(chatId, "Уведомления о повышении цен в аптеках включены");
      break;
    default:
      const {
        symptom,
        answer
      } = JSON.parse(query.data);
      // parse data into firebase
      switch (symptom) {
        case kb.symptoms.fever:
          sendQuestion(chatId, kb.symptoms.cough, keyboards.q2A);
          break;
        case kb.symptoms.cough:
          sendQuestion(chatId, kb.symptoms.weakness, keyboards.q3A);
          break;
        case kb.symptoms.weakness:
          sendQuestion(chatId, kb.symptoms.shortness_of_breath, keyboards.q4A);
          break;
        case kb.symptoms.shortness_of_breath:
          sendQuestion(chatId, kb.symptoms.headache, keyboards.q5A);
          break;
        case kb.symptoms.headache:
          sendQuestion(chatId, kb.symptoms.body_aches, keyboards.q6A);
          break;
        case kb.symptoms.body_aches:
          sendQuestion(chatId, kb.symptoms.sore_throat, keyboards.q7A);
          break;
        case kb.symptoms.sore_throat:
          sendQuestion(chatId, kb.symptoms.chills, keyboards.q8A);
          break;
        case kb.symptoms.chills:
          sendQuestion(chatId, kb.symptoms.runny_nose, keyboards.q9A);
          break;
        case kb.symptoms.runny_nose:
          sendQuestion(chatId, kb.symptoms.sneezing, keyboards.q10A);
          break;
        case kb.symptoms.sneezing:
          // end
          break;
        default:
          break;
      }
      break;
  }
});

function sendQuestion(chatId, symptom, question) {
  bot.sendMessage(chatId, `У вас есть ${symptom}?`, {
    reply_markup: {
      inline_keyboard: question
    }
  });
}