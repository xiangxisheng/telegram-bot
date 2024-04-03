const fs = require('fs');
const ApiTelegram = require('./api-telegram');
const mqtt = require('mqtt');
const { emitKeypressEvents } = require('readline');

const gData = {};
async function subscribe_add(mqttClient, topic, userid) {
	if (!gData.subscribe[topic]) {
		gData.subscribe[topic] = {};
	}
	gData.subscribe[topic].userids = {};
	gData.subscribe[topic].userids[userid] = {};
	const subscribed = await mqttClient.subscribeAsync(topic, { qos: 0 });
	console.log(`subscribed =>`, subscribed);
	// 添加完成后就可以保存json文件了
	fs.writeFileSync('data.subscribe.json', JSON.stringify(gData.subscribe))
};

const tg_fromId = {};
function tg_from_get(from_id, key) {
	//const from_id = msg.from.id;
	if (!tg_fromId[from_id]) {
		return;
	}
	return tg_fromId[from_id][key];
}
function tg_from_set(from_id, key, val) {
	//const from_id = msg.from.id;
	if (!tg_fromId[from_id]) {
		tg_fromId[from_id] = {};
	}
	tg_fromId[from_id][key] = val;
}

function get_userids_by_topic(dataSubscribe, topic) {
	// 获得某个主题被订阅的全部userid
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

async function start() {
	const url = "mqtts://i6ea568f.ala.cn-hangzhou.emqxsl.cn:8883"
	const clientId = 'telegram';
	const username = 'firadio';
	const password = 'firadio';
	const clean = true;
	// 第一步：连接MQTT
	const mqttClient = await mqtt.connectAsync(url, {
		clientId,
		username,
		password,
		clean,
	});

	// 第2步：开始机器人脚本
	const bot = await ApiTelegram(process.env.TELEGRAM_API_TOKEN);
	function menu_main(text) {
		const reply_markup = {
			"inline_keyboard": [
				[
					{ "text": "新增订阅", "callback_data": "subscribe_new" },
					{ "text": "订阅列表", "callback_data": "subscribe_list" }
				],
				[
					{ "text": "按钮3", "callback_data": "button3" }
				]
			]
		};
		return { text, reply_markup: JSON.stringify(reply_markup) };
	}
	bot.start(
		async function (msg) {
			console.log(msg);
			bot.deleteMessage(msg.chat.id, msg.message_id);
			// 命令相关的优先处理
			if (msg.text === '/start') {
				return menu_main("请选择您要操作的功能");
			}
			// 命令相关处理结束
			if (tg_from_get(msg.from.id, 'cmdflag') === 'subscribe') {
				tg_from_set(msg.from.id, 'cmdflag', '');
				subscribe_add(mqttClient, msg.text, msg.from.id);
				return { text: '订阅成功' };
			}
			return { text: msg.text };
		},
		async function (from_id, data) {
			console.log(from_id, data);
			if (data === 'main') {
				return menu_main("请选择您要操作的功能");
			}
			if (data === 'subscribe_new') {
				tg_from_set(from_id, 'cmdflag', 'subscribe');
				const reply_markup = {
					"inline_keyboard": [
						[
							{ "text": "返回主菜单", "callback_data": "main" }
						]
					]
				};
				return { text: "好的，请发送您要订阅的频道，例如testtopic/#", reply_markup: JSON.stringify(reply_markup) };
			}
			if (data === 'subscribe_list') {
				const reply_markup = {
					"inline_keyboard": [
						[
							{ "text": "按钮11", "callback_data": "button1" },
							{ "text": "按钮22", "callback_data": "button2" }
						],
						[
							{ "text": "返回主菜单", "callback_data": "main" }
						]
					]
				};
				return { text: "请选择您要操作的订阅", reply_markup: JSON.stringify(reply_markup) };
			}
		}
	);

	// 第3步：监听消息
	mqttClient.on('message', (topic, payload) => {
		const userids = get_userids_by_topic(gData.subscribe, topic);
		for (const k in userids) {
			const userid = userids[k];
			bot.sendMessage(userid, { text: payload.toString() });
		}
		console.log('Received Message:', topic, payload.toString())
	});

	// 第4步：订阅消息
	gData.subscribe = fs.existsSync('data.subscribe.json') ? JSON.parse(fs.readFileSync('data.subscribe.json')) : {};
	for (const topic in gData.subscribe) {
		const subscribed = await mqttClient.subscribeAsync(topic, { qos: 0 });
		console.log(`subscribed =>`, subscribed);
	}


};

function delay(ms) {
	return new Promise((resolve) => {
		setTimeout(() => { resolve(); }, ms)
	});
};

async function main() {
	while (1) {
		try {
			await start();
			break;
		} catch (e) {
			console.error(e);
		}
		await delay(1000);
	}
}
main();
