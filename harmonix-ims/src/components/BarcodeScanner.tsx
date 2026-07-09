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
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let stopped = false

    reader.decodeFromConstraints(
      { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
      videoRef.current!,
      (result, error, controls) => {
        if (stopped) return
        controlsRef.current = controls
        if (result) {
          stopped = true
          controls.stop()
          onScan(result.getText())
        } else if (error && status === 'starting') {
          setStatus('scanning')
        }
      }
    ).then(controls => {
      if (!stopped) {
        controlsRef.current = controls
        setStatus('scanning')
      }
    }).catch(err => {
      setStatus('error')
      if (err?.name === 'NotAllowedError') {
        setErrorMsg('Camera permission denied. Please allow camera access and try again.')
      } else if (err?.name === 'NotFoundError') {
        setErrorMsg('No camera found on this device.')
      } else {
        setErrorMsg(err?.message ?? 'Could not start camera.')
      }
    })

    return () => {
      stopped = true
      controlsRef.current?.stop()
    }
  }, [])

  function handleClose() {
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
            <p className="text-sm text-red-600 font-medium">{errorMsg}</p>
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
              {/* scanning guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-64 h-20">
                  <div className="absolute inset-0 border-2 border-orange rounded-md opacity-80" />
                  {/* corner accents */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-orange rounded-tl" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-orange rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-orange rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-orange rounded-br" />
                  {/* scanning line animation */}
                  <div className="absolute left-1 right-1 h-0.5 bg-orange/70 rounded animate-bounce" style={{ top: '45%' }} />
                </div>
              </div>
              {status === 'starting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="px-4 py-4">
              <p className="text-xs text-gray-500 text-center mb-3">
                Point the camera at the barcode on the back of the book
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
