/**
 * SCRIPT MÔ PHỎNG ESP32 (Dùng để test khi không cắm mạch thật)
 * Script này đóng vai trò như vi điều khiển ESP32:
 * 1. Định kỳ 3 giây gửi dữ liệu cảm biến ngẫu nhiên lên topic "ssdata"
 * 2. Lắng nghe topic "dvcontrol" và gửi lại xác nhận lên "dvrespond"
 */

const mqtt = require('mqtt');

const MQTT_BROKER = 'mqtt://broker.hivemq.com:1883';
const TOPIC_SENSOR = 'ssdata';
const TOPIC_CONTROL = 'dvcontrol';
const TOPIC_RESPOND = 'dvrespond';

const client = mqtt.connect(MQTT_BROKER, {
  clientId: 'ESP32_SIMULATOR_B23DCAT015',
});

let ledState = { LED1: 'OFF', LED2: 'OFF', LED3: 'OFF', LED4: 'OFF' };

client.on('connect', () => {
  console.log('\n🤖 [ESP32 Simulator] Đã kết nối tới broker.hivemq.com!');
  client.subscribe(TOPIC_CONTROL, () => {
    console.log(`🤖 [ESP32 Simulator] Đang lắng nghe lệnh từ Web tại topic: "${TOPIC_CONTROL}"\n`);
  });

  // Gửi trạng thái ban đầu
  publishRespond();

  // Phát dữ liệu cảm biến định kỳ mỗi 3 giây (y hệt loop() trong main.cpp của ESP32)
  setInterval(() => {
    const temp = +(26 + Math.random() * 5).toFixed(1);   // 26 - 31 °C
    const humid = +(60 + Math.random() * 20).toFixed(1); // 60 - 80 %
    const lux = Math.floor(300 + Math.random() * 500);   // 300 - 800 Lux
    const gas = +(200 + Math.random() * 320).toFixed(1); // 200 - 520 ppm (cảm biến ngẫu nhiên MQ-2)

    const payload = JSON.stringify({
      tem: temp,
      humid: humid,
      lux: lux,
      gas: gas,
    });

    client.publish(TOPIC_SENSOR, payload);
    console.log(`📤 [ESP32 Simulator -> "${TOPIC_SENSOR}"]: ${payload}`);
  }, 3000);
});

client.on('message', (topic, message) => {
  if (topic === TOPIC_CONTROL) {
    const cmdStr = message.toString();
    console.log(`📥 [ESP32 Simulator nhận lệnh từ "${TOPIC_CONTROL}"]: ${cmdStr}`);

    try {
      const cmd = JSON.parse(cmdStr);
      // Giả lập đóng ngắt chân GPIO
      if (cmd.led1 !== undefined) ledState.LED1 = cmd.led1 ? 'ON' : 'OFF';
      if (cmd.led2 !== undefined) ledState.LED2 = cmd.led2 ? 'ON' : 'OFF';
      if (cmd.led3 !== undefined) ledState.LED3 = cmd.led3 ? 'ON' : 'OFF';
      if (cmd.led4 !== undefined) ledState.LED4 = cmd.led4 ? 'ON' : 'OFF';

      // Giả lập độ trễ phần cứng 50ms rồi gửi Hardware ACK
      setTimeout(() => {
        publishRespond();
      }, 50);
    } catch (e) {
      console.error('Lỗi parse lệnh:', e.message);
    }
  }
});

function publishRespond() {
  const ackPayload = JSON.stringify(ledState);
  client.publish(TOPIC_RESPOND, ackPayload);
  console.log(`🔁 [ESP32 Simulator -> "${TOPIC_RESPOND}" (ACK)]: ${ackPayload}`);
}
