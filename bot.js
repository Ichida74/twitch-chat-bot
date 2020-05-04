const params = require('./bot-params.js');
const tmi = require('tmi.js');

const messagesNominative = ['сообщений', 'сообщение', 'сообщения'],
  connectOptions = {
    connection: {
      reconnect: true
    },
    identity: {
      username: params.bot.name,
      password: params.bot.password,
    },
    channels: [
      params.channel
    ]
  },
  client = new tmi.client(connectOptions),
  RANDOM_MESSAGE_EVENT = 10;

let usersMessagesCount = {},
  userDuelQueue = [],
  userDuelDelay = [],
  timerId;

client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

client.connect();

function onMessageHandler (target, context, msg, self) {
  const messageWords = msg.trim().split(' ');
  const user = context.username;

  if (self || user === params.bot.name)
    return;

  if (params.enableChatCommands) {
    switch (messageWords[0]) {
      case '!привет':
        client.say(target, `Привет, ${user}!`);
        return;

      case '!статистика':
        if (user === params.creator || user === params.channel) {
          echoBonusInConsole();
        }
        let messagesCount = user in usersMessagesCount ? usersMessagesCount[user] : 0;
        client.say(target, `${user}, у вас ${messagesCount} ${messagesNominative[getWordNominative(messagesCount)]} в чате.`);
        return;

      case '!топ':
        let top = [], count = Math.min(parseInt(messageWords[1], 10) || 10, 20), result = `Топ ${count}: `;
        for (let tmpUser in usersMessagesCount) {
          top.push([tmpUser, usersMessagesCount[tmpUser]]);
        }

        top.sort(function(a, b) {
          return b[1] - a[1];
        });
        for (let i in top) {
          if (count === 0)
            break;
          if (params.usersIgnored.indexOf(top[i][0]) !== -1)
            continue;
          result += top[i][0] + ': ' + top[i][1] + ', ';
          count--;
        }
        if (Object.keys(top).length) result = result.substring(0, result.length - 2);
        client.say(target, result);
        return;

      case '!очистить':
        if (user === params.creator || user === params.channel || user.mod === true) {
          echoBonusInConsole();
          usersMessagesCount = [];
          client.say(target, `Статистика сообщений успешно очищена.`);
        }
        return;

      case '!дуэль':
        if (userDuelDelay[user] && userDuelDelay[user] + params.duelDelayTimeout > Date.now()) {
          client.say(target, `${user}, передохни немного после предыдущей дуэли.`);
          return;
        }

        let isDuelInitiator = false,
          duelId = null,
          emptyDuelableId = null,
          currentDuel = null,
          duelable = (messageWords[1] || '').replace('@', '').toLowerCase() || null;

        userDuelQueue.forEach((element, index) => {
          if (element.duelInitiator === user) {
            isDuelInitiator = true;
          }
          if (element.duelable === user) {
            duelId = index;
          }
          if (element.duelable === null) {
            emptyDuelableId = index;
          }
        });

        if (isDuelInitiator) {
          client.say(target, `${user} вы уже ждете начала дуэли.`);
          return;
        }

        currentDuel = duelId !== null ? duelId : emptyDuelableId;

        if (currentDuel !== null) {
          clearTimeout(userDuelQueue[currentDuel].timeoutId);

          let random  = Math.random(),
            duelable = userDuelQueue[currentDuel].duelable || user,
            loser = random < 0.5 ? userDuelQueue[currentDuel].duelInitiator : duelable,
            winner = random < 0.5 ? duelable : userDuelQueue[currentDuel].duelInitiator;

          client.say(target, `Начало дуэли между ${userDuelQueue[currentDuel].duelInitiator} и ${duelable}.`);
          client.say(target, `${loser} проиграл дуэль и заблокирован на ${params.duelMuteTimeout} секунд.`);

          // Боту нужны права модератора
          let muteUserTimeout = setTimeout(() => {
            client.say(target, `/timeout ${loser} ${params.duelMuteTimeout}`);
          }, 1000);

          userDuelQueue.splice(currentDuel, 1);
          userDuelDelay[winner] = Date.now();
          return;
        }

        let timeoutId = setTimeout(() => {
          let index = userDuelQueue.findIndex(e => e.duelInitiator === user && e.duelable === duelable);
          if (index !== -1) {
            client.say(target, `${duelable || 'Никто'} не осмелился бросить вызов ${user}.`);
            userDuelQueue.splice(index, 1);
          }
        }, 60000);

        userDuelQueue.push({
          duelInitiator: user,
          duelable: duelable,
          timeoutId: timeoutId,
        });

        if (duelable)
          client.say(target, `${user} вызвал на дуэль ${duelable}. Осмелится ли он бросить ему вызов?`);
        else
          client.say(target, `${user} ждёт дуэлянта.`);

        return;
    }
  }

  if (params.enableRandomWordComplement) {
    let randomNumber = Math.floor(Math.random() * RANDOM_MESSAGE_EVENT);
    if (randomNumber === RANDOM_MESSAGE_EVENT - 1) {
      let splitMSG = msg.split(" "),
        wordRolled = Math.floor(Math.random() * splitMSG.length),
        word = splitMSG[wordRolled].replace(/[^а-яА-Я]/g, "");

      if (word.length > 3) {
        client.say(target, `${word} ${params.randomWordComplement}`);
      }
    }
  }

  if (params.enableMessageBonus) {
    if (user in usersMessagesCount)
      usersMessagesCount[user] += 1;
    else
      usersMessagesCount[user] = 1;
  }
}

function onConnectedHandler (addr, port) {
  console.log(`* Подключен к ${addr}:${port}`);
  console.log(`* Канал ${params.channel}`);
}

function echoBonusInConsole() {
  let date = new Date(),
    result = getLeadingZero(date.getHours()) + ':' + getLeadingZero(date.getMinutes()) + ' Пользовательские бонусы: {';

  for (let i in usersMessagesCount)
    result += `'${i}': ${usersMessagesCount[i]}, `;
  if (Object.keys(usersMessagesCount).length) result = result.substring(0, result.length - 2);
  result += '}';

  console.log(result);
}

function getLeadingZero(param) {
  return (param < 10 ? '0' : '') + param;
}

function getWordNominative(count) {
  if (Math.floor(count) !== count) {
    return 2
  } else if ((count % 100 >= 5 && count % 100 <= 20) || (count % 10 >= 5 && count % 10 <= 9) || count % 10 === 0) {
    return 0
  } else if (count % 10 === 1) {
    return 1
  } else if (count > 1) {
    return 2
  } else {
    return 0
  }
}

if (params.enableMessageBonus)
  timerId = setInterval(echoBonusInConsole, params.statisticsWriteDelay);
