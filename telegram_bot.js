const fs = require('fs');
const ApiTelegram = require('./api-telegram');
const mqtt = require('mqtt');
const { emitKeypressEvents } = require('readline');

const gData = {};
async function subscribe_add(mqttClient, topic, userid) {
	if (!gData.subscribe[topic]) {
		gData.subscribe[topic] = {};
	}
	if (!gData.subscribe[topic].userids) {
		gData.subscribe[topic].userids = {};
	}
	gData.subscribe[topic].userids[userid] = {};
	const subscribed = await mqttClient.subscribeAsync(topic, { qos: 0 });
	console.log(`subscribed =>`, subscribed);
	// 添加完成后就可以保存json文件了
	fs.writeFileSync('data.subscribe.json', JSON.stringify(gData.subscribe))
};
async function subscribe_remove(mqttClient, topic, userid) {
	if (!gData.subscribe[topic]) {
		return;
	}
	if (!gData.subscribe[topic].userids) {
		return;
	}
	delete gData.subscribe[topic].userids[userid];
	const unsubscribed = await mqttClient.unsubscribeAsync(topic, { qos: 0 });
	console.log(`unsubscribed =>`, unsubscribed);
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
					{ "text": "我的", "callback_data": "me" },
					{ "text": "新增订阅", "callback_data": "subscribe_new" },
					{ "text": "订阅列表", "callback_data": "subscribe_list" }
				],
			]
		};
		return { text, reply_markup: JSON.stringify(reply_markup) };
	}
	function menu_sub(text, inline_keyboard = [], mBackMenu) {
		const reply_markup = {
			inline_keyboard,
		};
		reply_markup.inline_keyboard.push([mBackMenu]);
		return { text, reply_markup: JSON.stringify(reply_markup) };
	}
	bot.start(
		async function (msg) {
			const from_id = msg.from.id;
			console.log(msg);
			// 命令相关的优先处理
			if (msg.text === '/start') {
				tg_from_set(from_id, 'cmdflag', '');
				return menu_main(`请选择您要操作的功能`);
			}
			// 命令相关处理结束
			if (tg_from_get(from_id, 'cmdflag') === 'subscribe') {
				tg_from_set(from_id, 'cmdflag', '');
				subscribe_add(mqttClient, msg.text, from_id);
				bot.deleteMessage(msg.chat.id, msg.message_id);
				return menu_main(`订阅成功`);
			}
			return { text: msg.text };
		},
		async function (from_id, sData) {
			console.log(from_id, sData);
			const aData = sData.split(':');
			if (aData[0] === 'main') {
				tg_from_set(from_id, 'cmdflag', '');
				return menu_main(`请选择您要操作的功能`);
			}
			if (aData[0] === 'me') {
				return menu_sub(`您的from_id是${from_id}`, [], { "text": "返回主菜单", "callback_data": "main" });
			}
			if (aData[0] === 'subscribe_new') {
				tg_from_set(from_id, 'cmdflag', 'subscribe');
				return menu_sub(`请选择您要订阅的主题`, [], { "text": "返回主菜单", "callback_data": "main" });
			}
			if (aData[0] === 'subscribe_list') {
				const aList = [];
				for (const sTopic in gData.subscribe) {
					const mTopicInfo = gData.subscribe[sTopic];
					for (const sUserid in mTopicInfo.userids) {
						if (sUserid == from_id) {
							aList.push([{ "text": sTopic, "callback_data": `subscribe_info:${sTopic}` }]);
						}
					}
				}
				return menu_sub(`请选择您要操作的订阅`, aList, { "text": "返回主菜单", "callback_data": "main" });
			}
			if (aData[0] === 'subscribe_info') {
				return menu_sub(`您想对订阅 ${aData[1]} 操作什么？`, [
					[{ "text": "取消订阅", "callback_data": `subscribe_remove:${aData[1]}` }],
				], { "text": "返回订阅列表", "callback_data": `subscribe_list` });
			}
			if (aData[0] === 'subscribe_remove') {
				subscribe_remove(mqttClient, aData[1], from_id);
				return menu_sub(`已经对 ${aData[1]} 取消订阅了！`, [], { "text": "返回订阅列表", "callback_data": `subscribe_list` });
			}
		}
	);

	// 第3步：监听消息
	mqttClient.on('message', (topic, payload) => {
		const aTopic = topic.split('/');
		if (aTopic.length === 3) {
			if (aTopic[1] === 'telegram_chat_id') {
				bot.sendMessage(aTopic[2], { text: payload.toString() });
			}
		}
		const userids = get_userids_by_topic(gData.subscribe, topic);
		for (const k in userids) {
			const userid = userids[k];
			bot.sendMessage(userid, { text: payload.toString() });
		}
		console.log('Received Message:', topic, payload.toString())
	});

	// 第4步：订阅消息
	gData.subscribe = fs.existsSync('data.subscribe.json') ? JSON.parse(fs.readFileSync('data.subscribe.json')) : {};
	//gData.subscribe["telegram_chat_id/#"] = {};
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
