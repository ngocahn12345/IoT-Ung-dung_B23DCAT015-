#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <BH1750.h>
#include <DHT.h>
#include <PubSubClient.h>

// Thông tin kết nối mạng WiFi & MQTT Broker
const char* ssid = "Blue House";
const char* password = "Chaomungban222";
const char* mqtt_server = "broker.hivemq.com";

// Định nghĩa các MQTT Topics
const char* topic_sensor = "ssdata";
const char* topic_control = "dvcontrol";
const char* topic_respond = "dvrespond";

// Cấu hình chân GPIO 
#define SDA_PIN 8
#define SCL_PIN 9
#define DHT_PIN 1
#define DHT_TYPE DHT11
#define LED_1 5
#define LED_2 6
#define LED_3 7

// Đối tượng phần cứng & mạng
BH1750 lightMeter;
DHT dht(DHT_PIN, DHT_TYPE);
WiFiClient wifiClient;
PubSubClient client(wifiClient);

// Biến trạng thái hệ thống
bool bh1750Ready = false;
bool led1Auto = true;
bool led2Auto = true;
bool led3Auto = true;
unsigned long lastRead = 0;
unsigned long lastBh1750Retry = 0;

void connectWiFi();
void reconnectMQTT();
void callback(char* topic, byte* payload, unsigned int length);
void publishDeviceRespond();
void controlAutomaticLeds(float temp, float humid, float lux);
bool initializeBH1750();
void scanI2C();
bool jsonBool(const String& message, const char* key, bool& value);
bool jsonAuto(const String& message, const char* key);

// Luồng khởi động
void setup()
{
  Serial.begin(115200);
  delay(1500);
  Serial.println();
  Serial.println("=== ESP32 STARTED ===");

  // Cấu hình chân GPIO cho 3 đèn LED
  pinMode(LED_1, OUTPUT);
  pinMode(LED_2, OUTPUT);
  pinMode(LED_3, OUTPUT);
  digitalWrite(LED_1, LOW);
  digitalWrite(LED_2, LOW);
  digitalWrite(LED_3, LOW);

  //  Khởi tạo bus I2C, BH1750, DHT
  Wire.begin(SDA_PIN, SCL_PIN);
  delay(100);
  scanI2C();
  bh1750Ready = initializeBH1750();
  dht.begin();

  // Kết nối mạng WiFi
  connectWiFi();

  // Cấu hình MQTT Server và gán hàm nhận lệnh
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);

  Serial.println("He thong da khoi dong xong!");
}

// Vòng lặp chính
void loop()
{
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  if (WiFi.status() == WL_CONNECTED && !client.connected()) {
    reconnectMQTT();
  }

  // Lắng nghe gói tin đến từ MQTT 
  client.loop();

  // Đọc cảm biến
  if (millis() - lastRead >= 3000) {
    lastRead = millis();

    float temp = dht.readTemperature();
    float humid = dht.readHumidity();

    if (!bh1750Ready && millis() - lastBh1750Retry >= 10000) {
      lastBh1750Retry = millis();
      Serial.println("Dang thu ket noi lai BH1750...");
      bh1750Ready = initializeBH1750();
    }

    float lux = bh1750Ready ? lightMeter.readLightLevel() : -2.0;

    Serial.printf("[Sensor] Temp: %.1f *C | Hum: %.1f %% | Lux: %.1f lx\n", temp, humid, lux);

    if (!isnan(temp) && !isnan(humid)) {
      char buffer[160];
      snprintf(buffer, sizeof(buffer),
               "{\"tem\":%.2f,\"humid\":%.2f,\"lux\":%.2f}",
               temp, humid, lux);
      if (client.publish(topic_sensor, buffer)) {
        Serial.println(buffer);
      } else {
        Serial.print("PUB FAILED -> ");
        Serial.println(topic_sensor);
      }
    }

    controlAutomaticLeds(temp, humid, lux);
  }
}

void reconnectMQTT()
{
  int attempts = 0;
  while (!client.connected() && WiFi.status() == WL_CONNECTED && attempts < 3) {
    attempts++;
    Serial.print("Connecting to MQTT...");
    String clientId = "ESP32_Bai2_B23DCAT015" + String((uint32_t)ESP.getEfuseMac(), HEX);

    if (client.connect(clientId.c_str())) {
      Serial.println(" CONNECTED!");

      // lắng nghe lệnh điều khiển từ người dùng
      if (!client.subscribe(topic_control)) {
        Serial.println("MQTT subscribe FAILED");
      }

      // Gửi trạng thái thực tế hiện tại của 3 đèn lên Web
      publishDeviceRespond();
    } else {
      Serial.print(" Failed, rc=");
      Serial.print(client.state());
      Serial.println(" Retry in 5s...");
      delay(5000);
    }
  }
}

void callback(char* topic, byte* payload, unsigned int length)
{
  String message;
  for (unsigned int index = 0; index < length; index++) {
    message += static_cast<char>(payload[index]);
  }

  bool value;
  if (jsonBool(message, "led1_auto", value) || jsonBool(message, "LED1_AUTO", value)) led1Auto = value;
  if (jsonBool(message, "led2_auto", value) || jsonBool(message, "LED2_AUTO", value)) led2Auto = value;
  if (jsonBool(message, "led3_auto", value) || jsonBool(message, "LED3_AUTO", value)) led3Auto = value;

  if (jsonAuto(message, "LED1") || jsonAuto(message, "led1")) led1Auto = true;
  if (jsonAuto(message, "LED2") || jsonAuto(message, "led2")) led2Auto = true;
  if (jsonAuto(message, "LED3") || jsonAuto(message, "led3")) led3Auto = true;

  if (!jsonAuto(message, "LED1") && !jsonAuto(message, "led1") &&
      (jsonBool(message, "led1", value) || jsonBool(message, "LED1", value))) {
    led1Auto = false;
    digitalWrite(LED_1, value ? HIGH : LOW);
  }
  if (!jsonAuto(message, "LED2") && !jsonAuto(message, "led2") &&
      (jsonBool(message, "led2", value) || jsonBool(message, "LED2", value))) {
    led2Auto = false;
    digitalWrite(LED_2, value ? HIGH : LOW);
  }
  if (!jsonAuto(message, "LED3") && !jsonAuto(message, "led3") &&
      (jsonBool(message, "led3", value) || jsonBool(message, "LED3", value))) {
    led3Auto = false;
    digitalWrite(LED_3, value ? HIGH : LOW);
  }

  Serial.print("MQTT lenh: ");
  Serial.print(message);
  Serial.println();

  // Gửi xác nhận trạng thái đèn thực tế về lại Web
  publishDeviceRespond();
}

void publishDeviceRespond()
{
  char buffer[256];
  snprintf(buffer, sizeof(buffer), "{\"LED1\":\"%s\",\"LED2\":\"%s\",\"LED3\":\"%s\"}",
           digitalRead(LED_1) ? "ON" : "OFF",
           digitalRead(LED_2) ? "ON" : "OFF",
           digitalRead(LED_3) ? "ON" : "OFF");

  client.publish(topic_respond, buffer, true);
}

void connectWiFi()
{
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.setTxPower(WIFI_POWER_8_5dBm);

  WiFi.begin(ssid, password);

  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startTime < 20000) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.print("WiFi FAILED, status code: ");
    Serial.println(WiFi.status());
    return;
  }

  Serial.print("WiFi Connected! IP: ");
  Serial.println(WiFi.localIP());
  Serial.println("WiFi status: CONNECTED");
}

void controlAutomaticLeds(float temp, float humid, float lux)
{
  bool changed = false;

  // LED 1: Nhiệt độ > 35°C thì bật
  if (led1Auto && !isnan(temp)) {
    bool newState = temp > 35.0;
    if (newState != (digitalRead(LED_1) == HIGH)) {
      digitalWrite(LED_1, newState ? HIGH : LOW);
      changed = true;
    }
  }

  // LED 2: Độ ẩm > 70% thì bật
  if (led2Auto && !isnan(humid)) {
    bool newState = humid > 70.0;
    if (newState != (digitalRead(LED_2) == HIGH)) {
      digitalWrite(LED_2, newState ? HIGH : LOW);
      changed = true;
    }
  }

  // LED 3: Ánh sáng < 100 lux thì bật
  if (led3Auto && !isnan(lux) && lux >= 0) {
    bool newState = lux < 100.0;
    if (newState != (digitalRead(LED_3) == HIGH)) {
      digitalWrite(LED_3, newState ? HIGH : LOW);
      changed = true;
    }
  }

  if (changed && client.connected()) {
    publishDeviceRespond();
  }
}

// Khởi tạo BH1750 qua I2C
bool initializeBH1750()
{
  bool ready = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23);
  if (!ready) {
    ready = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x5C);
  }

  if (ready) {
    Serial.println("BH1750: San sang!");
  } else {
    Serial.println("BH1750: Khong phan hoi tai 0x23/0x5C");
  }
  return ready;
}

void scanI2C()
{
  Serial.println("I2C scan:");
  bool found = false;

  for (uint8_t address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() == 0) {
      Serial.print("  Found device at 0x");
      Serial.println(address, HEX);
      found = true;
    }
  }

  if (!found) {
    Serial.println("  No I2C device found");
  }
}

bool jsonBool(const String& message, const char* key, bool& value)
{
  String trueValue = String("\"") + key + "\":true";
  String falseValue = String("\"") + key + "\":false";
  String onValue = String("\"") + key + "\":\"ON\"";
  String offValue = String("\"") + key + "\":\"OFF\"";

  if (message.indexOf(trueValue) >= 0 || message.indexOf(onValue) >= 0) {
    value = true;
    return true;
  }
  if (message.indexOf(falseValue) >= 0 || message.indexOf(offValue) >= 0) {
    value = false;
    return true;
  }
  return false;
}

bool jsonAuto(const String& message, const char* key)
{
  String autoValue = String("\"") + key + "\":\"AUTO\"";
  return message.indexOf(autoValue) >= 0;
}