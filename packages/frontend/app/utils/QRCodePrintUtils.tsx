import { QRCode } from 'antd'
import { createRoot } from 'react-dom/client'

const printQRCode = (
  courseName: string,
  inviteURL: string,
  QRCodeErrorLevel?: 'L' | 'M',
  queueName?: string,
) => {
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(`
        <html>
          <head>
            <title>HelpMe | ${queueName ?? courseName} QR Code ${queueName ? `(${courseName})` : ''}</title>
            <style>
              body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;  }
              h1 { text-align: center; }
              .qrcode { display: flex; justify-content: center; flex-direction: column; align-items: center; }
            </style>
          </head>
          <body>
            <div class="qrcode">
              <h1>Scan to join ${queueName ? `${queueName} for ` : ''}${courseName}</h1>
              <div id="qrcode"></div>
            </div>
          </body>
        </html>
      `)
    printWindow.document.close()

    const qrCodeContainer = printWindow.document.getElementById('qrcode')
    if (qrCodeContainer) {
      const qrCodeElement = (
        <QRCode
          errorLevel={QRCodeErrorLevel ?? 'L'}
          value={inviteURL}
          icon="/helpme_logo_small.png"
          size={400}
          onLoad={() => {
            // Dispatch custom event when QR code is fully rendered
            const event = new Event('qrcodeRendered')
            printWindow.dispatchEvent(event)
          }}
        />
      )
      const root = createRoot(qrCodeContainer)
      root.render(qrCodeElement)

      // Listen for the custom event to trigger the print
      printWindow.addEventListener('qrcodeRendered', () => {
        printWindow.print()
      })
    }
  }
}

export default printQRCode
