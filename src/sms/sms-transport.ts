export interface Sms {
  // In E.164, such as +4915112345678.
  to: string;
  text: string;
}

// One per provider. Adding one takes a class like these, a name in SMS_DRIVERS
// and a case in SmsSender.createTransport.
export interface SmsTransport {
  send(sms: Sms): Promise<void>;
  close?(): void;
}
