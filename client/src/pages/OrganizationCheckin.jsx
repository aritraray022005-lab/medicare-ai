import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import jsQR from 'jsqr';
import { QrCode, Camera, CameraOff, Printer, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Patient Check-in & Ticket Generation (hospital organization portal).
 * - Scans the QR code shown in the patient's MedCare AI account (camera or USB/keyboard-wedge scanner).
 * - The backend validates the QR for THIS organization (taken from the login session, never from the browser).
 * - On success the internal consultation details are shown and a compact 80mm ticket can be printed.
 */

const PRINT_CSS = `
@media print {
  @page { size: 80mm auto; margin: 0; }
  body * { visibility: hidden !important; }
  #consultation-ticket, #consultation-ticket * { visibility: visible !important; }
  #consultation-ticket { position: absolute; left: 0; top: 0; width: 80mm; padding: 4mm; box-shadow: none !important; border: none !important; }
}
`;

const ConsultationTicket = ({ ticket }) => (
  <div
    id="consultation-ticket"
    className="bg-white text-black font-mono text-[12px] leading-snug border border-dashed border-gray-400 rounded p-4 mx-auto"
    style={{ width: '80mm', maxWidth: '100%' }}
  >
    <div className="text-center border-b border-dashed border-gray-500 pb-2 mb-2">
      <div className="text-[14px] font-bold uppercase">{ticket.hospitalName}</div>
      <div className="text-[11px]">CONSULTATION TICKET</div>
    </div>

    <div className="text-center my-2">
      <div className="text-[11px]">QUEUE / TOKEN NO.</div>
      <div className="text-[34px] font-extrabold tracking-wider">{ticket.queueLabel}</div>
    </div>

    <div className="border-t border-dashed border-gray-500 pt-2 space-y-1">
      <Row label="Patient" value={ticket.patientName} bold />
      <Row label="Doctor" value={`Dr. ${ticket.doctorName}`} />
      <Row label="Speciality" value={ticket.doctorSpecialization} />
      <Row label="Date" value={ticket.appointmentDate} />
      <Row label="Time" value={ticket.appointmentTime} />
    </div>

    <div className="border-2 border-black rounded my-3 p-2 text-center">
      <div className="text-[11px]">GO TO ROOM</div>
      <div className="text-[22px] font-extrabold">{ticket.roomNumber || '—'}</div>
      {ticket.floor && <div className="text-[13px] font-bold">Floor: {ticket.floor}</div>}
      {ticket.department && <div className="text-[11px]">{ticket.department}</div>}
    </div>

    <div className="border-t border-dashed border-gray-500 pt-2 space-y-1 text-[11px]">
      <Row label="Appt ID" value={ticket.appointmentId} small />
      <Row label="Checked in" value={ticket.checkInTimeDisplay} />
    </div>
    <div className="text-center text-[10px] mt-2">Please wait for your token to be called.</div>
  </div>
);

const Row = ({ label, value, bold, small }) => (
  <div className="flex justify-between gap-2">
    <span className="shrink-0">{label}:</span>
    <span className={`text-right ${bold ? 'font-bold' : ''} ${small ? 'text-[9px] break-all' : ''}`}>{value || '—'}</span>
  </div>
);

const OrganizationCheckin = () => {
  const [manualToken, setManualToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { ticket, consultation }
  const [error, setError] = useState(null); // { msg, code }
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const busyRef = useRef(false);
  const inputRef = useRef(null);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const res = await axios.get('/api/organizations/checkin/queue', { withCredentials: true });
      setQueue(res.data.queue || []);
    } catch {
      setQueue([]);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const submitToken = useCallback(async (rawToken) => {
    const token = (rawToken || '').trim();
    if (!token || busyRef.current) return;
    busyRef.current = true;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await axios.post('/api/organizations/checkin/scan', { token }, { withCredentials: true });
      setResult({ ticket: res.data.ticket, consultation: res.data.consultation });
      setManualToken('');
      stopCamera();
      loadQueue();
    } catch (err) {
      setError({
        msg: err.response?.data?.msg || 'Check-in failed. Please try again.',
        code: err.response?.data?.code || null
      });
    } finally {
      setSubmitting(false);
      // short cool-down so a QR held in front of the camera is not re-submitted in a loop
      setTimeout(() => { busyRef.current = false; }, 2500);
    }
  }, [loadQueue, stopCamera]);

  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA && !busyRef.current) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        submitToken(code.data);
      }
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  }, [submitToken]);

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraOn(true);
      // wait for the <video> element to mount
      setTimeout(async () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          rafRef.current = requestAnimationFrame(scanLoop);
        }
      }, 50);
    } catch {
      setCameraError('Camera is not available. Allow camera access, or use a USB scanner / paste the code below.');
    }
  };

  const reprint = async (appointmentId) => {
    try {
      const res = await axios.get(`/api/organizations/checkin/appointments/${appointmentId}/ticket`, { withCredentials: true });
      setError(null);
      setResult({ ticket: res.data.ticket, consultation: null });
    } catch (err) {
      setError({ msg: err.response?.data?.msg || 'Could not load the ticket.', code: null });
    }
  };

  const onManualSubmit = (e) => {
    e.preventDefault();
    submitToken(manualToken);
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <style>{PRINT_CSS}</style>

      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><QrCode size={24} /> Patient Check-in &amp; Ticket Generation</h1>
        <p className="text-sm text-gray-500 mt-1">
          Scan the QR code from the patient&apos;s MedCare AI account. Valid hospital appointments are checked in and a consultation ticket is generated for printing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Scan QR code</h2>
            {cameraOn ? (
              <button onClick={stopCamera} className="btn btn-outline btn-sm flex items-center gap-2"><CameraOff size={14} /> Stop camera</button>
            ) : (
              <button onClick={startCamera} className="btn btn-primary btn-sm flex items-center gap-2"><Camera size={14} /> Start camera</button>
            )}
          </div>

          {cameraError && <p className="text-sm text-red-600">{cameraError}</p>}

          {cameraOn && (
            <div className="relative rounded-lg overflow-hidden bg-black">
              <video ref={videoRef} playsInline muted className="w-full max-h-80 object-cover" />
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          <form onSubmit={onManualSubmit} className="space-y-2">
            <label htmlFor="qr-token" className="text-xs font-bold uppercase tracking-wider text-gray-600">
              USB / handheld scanner or pasted code
            </label>
            <div className="flex gap-2">
              <input
                id="qr-token"
                ref={inputRef}
                autoFocus
                autoComplete="off"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Click here, then scan with a handheld scanner"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
              />
              <button type="submit" disabled={submitting || !manualToken.trim()} className="btn btn-primary btn-sm">
                {submitting ? 'Checking...' : 'Check in'}
              </button>
            </div>
          </form>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm" role="alert">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Check-in rejected</p>
                <p>{error.msg}</p>
              </div>
            </div>
          )}
        </div>

        {/* Result + ticket */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          {!result ? (
            <div className="text-center text-gray-400 py-16">
              <QrCode size={48} className="mx-auto mb-3 opacity-50" />
              <p>Scan a patient QR code to see consultation details and print the ticket.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {result.consultation && (
                <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">Patient checked in</p>
                    <p>
                      {result.consultation.patientName} → Dr. {result.consultation.doctorName} ({result.consultation.doctorSpecialization})
                    </p>
                    <p className="font-semibold">
                      Room {result.consultation.roomNumber || '—'}
                      {result.consultation.floor ? `, Floor ${result.consultation.floor}` : ''} • Token {result.consultation.queueLabel}
                    </p>
                  </div>
                </div>
              )}

              <ConsultationTicket ticket={result.ticket} />

              <div className="flex justify-center">
                <button onClick={() => window.print()} className="btn btn-primary flex items-center gap-2">
                  <Printer size={16} /> Print ticket
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Today's queue */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">Today&apos;s checked-in patients</h2>
          <button onClick={loadQueue} className="btn btn-outline btn-sm flex items-center gap-2">
            <RefreshCw size={14} className={queueLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        {queue.length === 0 ? (
          <p className="text-sm text-gray-500">No patients have been checked in today.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b">
                  <th className="py-2 pr-3">Token</th>
                  <th className="pr-3">Patient</th>
                  <th className="pr-3">Doctor</th>
                  <th className="pr-3">Room</th>
                  <th className="pr-3">Time</th>
                  <th className="pr-3">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {queue.map((q) => (
                  <tr key={q.appointmentId} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-bold">{q.queueLabel}</td>
                    <td className="pr-3">{q.patientName}</td>
                    <td className="pr-3">Dr. {q.doctorName}</td>
                    <td className="pr-3">{q.roomNumber || '—'}{q.floor ? ` / ${q.floor}` : ''}</td>
                    <td className="pr-3">{q.appointmentTime}</td>
                    <td className="pr-3">{q.status}</td>
                    <td>
                      <button onClick={() => reprint(q.appointmentId)} className="text-xs text-purple-700 font-semibold hover:underline">
                        Re-print ticket
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationCheckin;
