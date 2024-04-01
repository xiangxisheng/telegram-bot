const fs = require('fs');
const ApiTelegram = require('./api-telegram');
const mqtt = require('mqtt');

const gData = {};
function subscribe_add(mqttClient, topic, userid) {
	if (!gData.subscribe[topic]) {
		gData.subscribe[topic] = {};
	}
	gData.subscribe[topic].userids = {};
	gData.subscribe[topic].userids[userid] = {};
	mqttClient.subscribe(topic, { qos: 0 }, (error) => {
		if (error) {
			console.log('unsubscribe error:', error)
			return
		}
		console.log(`unsubscribed topic: ${topic}`)
	});
	fs.writeFileSync('data.subscribe.json', JSON.stringify(gData.subscribe))
};

const tg_fromId = {};
function tg_from_get(msg, key) {
	if (!tg_fromId[msg.from.id]) {
		return;
	}
	return tg_fromId[msg.from.id][key];
}
function tg_from_set(msg, key, val) {
	if (!tg_fromId[msg.from.id]) {
		tg_fromId[msg.from.id] = {};
	}
	tg_fromId[msg.from.id][key] = val;
}

function get_userids_by_topic(dataSubscribe, topic) {
	const mUserid = {};
	const aPair1 = topic.split('/');
	const aPair2 = [];
	for (const k in aPair1) {
		aPair2.push(aPair1[k]);
		const searchTopic = aPair2.join('/') + '/#';
		if (!dataSubscribe[searchTopic]) {
			continue;
		}
		for (const userid in dataSubscribe[searchTopic].userids) {
			mUserid[userid] = true;
		}
	}
	const aUserids = [];
	for (const sUserid in mUserid) {
		aUserids.push(sUserid);
	}
	return aUserids;
}

async function main() {
	const url = "mqtts://i6ea568f.ala.cn-hangzhou.emqxsl.cn:8883"
	const clientId = 'telegram';
	const username = 'firadio';
	const password = 'firadio';
	const mqttClient = mqtt.connect(url, {
		clientId,
		username,
		password,
	});

	gData.subscribe = fs.existsSync('data.subscribe.json') ? JSON.parse(fs.readFileSync('data.subscribe.json')) : {};
	for (const topic in gData.subscribe) {
		mqttClient.subscribe(topic, { qos: 0 }, (error) => {
			if (error) {
				console.log('subscribe error:', error)
				return
			}
			console.log(`subscribed topic: ${topic}`)
		});
	}

	const bot = await ApiTelegram(process.env.TELEGRAM_API_TOKEN);
	mqttClient.on('message', (topic, payload) => {
		const userids = get_userids_by_topic(gData.subscribe, topic);
		for (const k in userids) {
			const userid = userids[k];
			bot.sendMessage(userid, payload.toString());
		}
		console.log('Received Message:', topic, payload.toString())
	});

	bot.start(async function (msg) {
		console.log('msg', msg);
		if (tg_from_get(msg, 'cmdflag') === 'subscribe') {
			tg_from_set(msg, 'cmdflag', '');
			subscribe_add(mqttClient, msg.text, msg.from.id);
			return '订阅成功';
		}
		if (msg.text === '/subscribe') {
			tg_from_set(msg, 'cmdflag', 'subscribe');
			return "好的，请发送您要订阅的频道，例如 <testtopic/#>";
		}
		return msg.text;
	});
};
main();

