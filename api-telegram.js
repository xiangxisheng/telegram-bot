const http2_fetch = require('./http2_fetch');

module.exports = async function (token) {
	const options = {};
	options.servername = 'api.telegram.org';
	options.hostname = '149.154.167.220';
	options.hostname = '2001:67c:4e8:f004::9';
	options.port = 443;
	const clientSession = await http2_fetch(options);
	const oPrivate = {
		update_id: 0,
		async checkError(data) {
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
		},
		delay(s) {
			return new Promise((resolve) => {
				setTimeout(() => { resolve(); }, s)
			});
		},
		async getBotDataByMethodAndParam(sMethod, mParams) {
			const oParams = new URLSearchParams();
			for (const k in mParams) {
				const v = mParams[k];
				oParams.append(k, v);
			}
			const sPath = `/bot${token}/${sMethod}?${oParams.toString()}`;
			const res = await clientSession.get(sPath);
			const data = (await res.json());
			await oPrivate.checkError(data);
			return data;
		},
	}
	const oPublic = {
		async getUpdates(update_id) {
			const oParams = new URLSearchParams();
			oParams.append('timeout', 10);
			oParams.append('offset', update_id);
			const path = `/bot${token}/getUpdates?${oParams.toString()}`;
			const res = await clientSession.get(path);
			const data = (await res.json());
			await oPrivate.checkError(data);
			return data;
		},
		async start(do_message, do_callback_query) {
			// 连接BotAPI
			console.log('Telegram机器人已启动');
			while (1) {
				// 循环获取消息更新
				try {
					const data = await oPublic.getUpdates(oPrivate.update_id + 1);
					for (const mRow of data.result) {
						// 遍历消息内容
						oPrivate.update_id = mRow.update_id;
						//console.log(mRow);
						if (mRow.message) {
							const message = mRow.message;
							const mParams = await do_message(message);
							//console.log(new Date(), message.from.id, message, response_text);
							oPublic.sendMessage(message.from.id, mParams);
						}
						if (mRow.callback_query) {
							const mParams = await do_callback_query(mRow.callback_query.from.id, mRow.callback_query.data);
							oPublic.editMessageText(mRow.callback_query.from.id, mRow.callback_query.message.message_id, mParams);
						}
					};
				} catch (e) {
					await oPrivate.delay(5000);
				}
			}
		},
		async sendMessage(chat_id, mParams = {}) {
			mParams['chat_id'] = chat_id;
			return await oPrivate.getBotDataByMethodAndParam('sendMessage', mParams);
		},
		async editMessageText(chat_id, message_id, mParams = {}) {
			mParams['chat_id'] = chat_id;
			mParams['message_id'] = message_id;
			return await oPrivate.getBotDataByMethodAndParam('editMessageText', mParams);
		},
		async deleteMessage(chat_id, message_id, mParams = {}) {
			mParams['chat_id'] = chat_id;
			mParams['message_id'] = message_id;
			return await oPrivate.getBotDataByMethodAndParam('deleteMessage', mParams);
		},
	}
	return oPublic;
};
