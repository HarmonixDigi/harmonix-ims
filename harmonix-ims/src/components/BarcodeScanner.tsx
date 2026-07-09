import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { X } from 'lucide-react'

interface Props {
  onScan: (code: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const activeRef = useRef(true)
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    activeRef.current = true

    async function start() {
      try {
        const reader = new BrowserMultiFormatReader()

        // prefer back camera on mobile, fall back to default
        let deviceId: string | undefined
        try {
          const devices = await BrowserMultiFormatReader.listVideoInputDevices()
          const back = devices.find(d => /back|rear|environment/i.test(d.label))
          deviceId = back?.deviceId ?? devices[0]?.deviceId
        } catch { /* use default */ }

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result) => {
            if (!activeRef.current || !result) return
            activeRef.current = false
            controlsRef.current?.stop()
            onScan(result.getText())
          }
        )

        controlsRef.current = controls

        if (activeRef.current) setStatus('scanning')

      } catch (err: unknown) {
        if (!activeRef.current) return
        setStatus('error')
        const e = err as { name?: string; message?: string }
        if (e?.name === 'NotAllowedError') {
          setErrorMsg('Camera permission denied. Please allow camera access and try again.')
        } else if (e?.name === 'NotFoundError') {
          setErrorMsg('No camera found on this device.')
        } else {
          setErrorMsg(e?.message ?? 'Could not start camera.')
        }
      }
    }

    start()

    return () => {
      activeRef.current = false
      controlsRef.current?.stop()
    }
  }, [])

  function handleClose() {
    activeRef.current = false
    controlsRef.current?.stop()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="font-bold text-gray-800 text-sm">Scan ISBN Barcode</span>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {status === 'error' ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">📷</div>
            <p className="text-sm text-red-600 font-medium mb-1">{errorMsg}</p>
            <button onClick={handleClose} className="mt-4 w-full py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="relative bg-black">
              <video
                ref={videoRef}
                className="w-full"
                style={{ maxHeight: '280px', objectFit: 'cover' }}
                muted
                playsInline
              />
              {/* aim guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-64 h-20">
                  <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-orange" />
                  <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-orange" />
                  <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-orange" />
                  <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-orange" />
                  {status === 'scanning' && (
                    <div className="absolute left-0 right-0 h-0.5 bg-orange/80 animate-bounce" style={{ top: '50%' }} />
                  )}
                </div>
              </div>
              {status === 'starting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="px-4 py-4">
              <p className="text-xs text-gray-500 text-center mb-3">
                {status === 'starting'
                  ? 'Starting camera…'
                  : 'Hold the barcode steady inside the box — it will fill in automatically'}
              </p>
              <button onClick={handleClose} className="w-full py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
