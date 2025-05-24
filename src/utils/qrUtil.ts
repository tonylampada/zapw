import QRCode from 'qrcode';

export async function generateQRDataURL(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 1,
      width: 256
    });
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

export function printQRToConsole(text: string): void {
  QRCode.toString(text, { type: 'terminal', small: true }, (err, qr) => {
    if (!err) {
      console.log('\nScan this QR code with WhatsApp:');
      console.log(qr);
    }
  });
}