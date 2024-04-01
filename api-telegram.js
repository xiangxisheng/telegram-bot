const http2_fetch = require('./http2_fetch');

module.exports = async function (token) {
	const options = {};
	options.servername = 'api.telegram.org';
	options.hostname = '149.154.167.220';
	options.hostname = '2001:67c:4e8:f004::9';
	options.port = 443;
	const clientSession = await http2_fetch(options);
	const oPublic = {};
	var update_id = 0;
	const checkError = async (data) => {
		if (!data.ok) {
			console.log(data);
			//throw new Error(data.description);
			return;
		}
		if (!data.result) {
			console.log(data);
			//throw new Error('[ERROR] data.result is undefined');
			return;
		}
	};
	function delay(s) {
		return new Promise((resolve) => {
			setTimeout(() => { resolve(); }, s)
		});
	}
	oPublic.getUpdates = async function (update_id) {
		const oParams = new URLSearchParams();
		oParams.append('timeout', 10);
		oParams.append('offset', update_id);
		const path = `/bot${token}/getUpdates?${oParams.toString()}`;
		const res = await clientSession.get(path);
		const data = (await res.json());
		await checkError(data);
		return data;
	};
	oPublic.start = async function (do_msg) {
		// 连接BotAPI
		console.log('Telegram机器人已启动');
		while (1) {
			// 循环获取消息更新
			try {
				const data = await oPublic.getUpdates(update_id + 1);
				for (const mRow of data.result) {
					// 遍历消息内容
					update_id = mRow.update_id;
					if (mRow.message) {
						const message = mRow.message;
						const response_text = await do_msg(message);
						//console.log(new Date(), message.from.id, message, response_text);
						oPublic.sendMessage(message.from.id, response_text);
					}
				};
			} catch (e) {
			}
			await delay(5000);
		}
	}
	oPublic.sendMessage = async function (chat_id, text) {
		const oParams = new URLSearchParams();
		oParams.append('chat_id', chat_id);
		oParams.append('text', text);
		const sPath = `/bot${token}/sendMessage?${oParams.toString()}`;
		const res = await clientSession.get(sPath);
		const data = (await res.json());
		checkError(data);
		return data;
	};
	return oPublic;
};
