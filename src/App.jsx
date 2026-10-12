import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ParkingCircle,
  MapPin,
  CarFront,
  Search,
  LogOut,
  PlusCircle,
  RefreshCw,
  UserRound,
  Building2,
  CalendarDays,
  LocateFixed,
  CheckCircle2,
  Clock,
  IndianRupee,
  Navigation,
  AlertCircle,
  LayoutDashboard,
  X,
  ExternalLink,
  Upload,
  CreditCard
} from "lucide-react";
import "./App.css";

const API = "http://localhost:8080/api";
const ACCOUNT_KEY = "parksmart-account";

function errorMessage(err, fallback) {
  return (
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    fallback
  );
}

function MapPanel({ position, locations }) {
  const point = locations?.[0];
  const center =
    position ||
    (point
      ? { latitude: point.latitude, longitude: point.longitude }
      : null);

  if (!center) {
    return (
      <div className="map-placeholder">
        <MapPin size={30} />
        <strong>Your parking map will appear here</strong>
        <span>Allow location access or add a location as a host.</span>
      </div>
    );
  }

  const lat = Number(center.latitude);
  const lon = Number(center.longitude);
  const delta = 0.025;
  const bbox = `${lon - delta}%2C${lat - delta}%2C${lon + delta}%2C${lat + delta}`;
  const marker = `${lat}%2C${lon}`;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;

  return (
    <div className="map-frame-wrap">
      <iframe
        title="OpenStreetMap nearby parking map"
        className="map-frame"
        src={mapUrl}
        loading="lazy"
      />
      <a
        className="map-open-link"
        href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`}
        target="_blank"
        rel="noreferrer"
      >
        <ExternalLink size={14} /> Open larger map
      </a>
    </div>
  );
}

export default function App() {
  const [account, setAccount] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(ACCOUNT_KEY) || "null");
    } catch {
      return null;
    }
  });

  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "USER"
  });
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [position, setPosition] = useState(null);
  const [nearbySlots, setNearbySlots] = useState([]);
  const [radius, setRadius] = useState("10");
  const [query, setQuery] = useState("");
  const [bookings, setBookings] = useState([]);
  const [hostSlots, setHostSlots] = useState([]);

  const [locationForm, setLocationForm] = useState({
    locationName: "",
    address: "",
    latitude: "",
    longitude: "",
    hourlyRate: "30",
    numberOfSlots: "5"
  });

  // Payment QR states
  const [qrFile, setQrFile] = useState(null);
  const [qrImagePath, setQrImagePath] = useState("");
  const [latestReservation, setLatestReservation] = useState(null);

  
const [paymentLoading, setPaymentLoading] = useState(false);


async function openPaymentQr(booking) {
  setError("");
  setNotice("");
  setPaymentLoading(true);

  try {
    if (booking.paymentStatus === "PAID") {
      setNotice("This booking has already been paid.");
      return;
    }

    const hostEmail = booking.hostEmail;

    if (!hostEmail) {
      setError(
        "The host email is missing from this booking. Please refresh your bookings."
      );
      return;
    }

    const response = await axios.get(
      `${API}/payment-settings/${encodeURIComponent(hostEmail)}`
    );

    const path = response.data?.qrImagePath || "";

    setLatestReservation({
      ...booking,
      qrImagePath: path
    });

    if (!path) {
      setNotice("This host has not uploaded a payment QR code yet.");
    }
  } catch (err) {
    setError(
      errorMessage(err, "Could not load this host's payment QR code.")
    );
  } finally {
    setPaymentLoading(false);
  }
}



  useEffect(() => {
    if (!account) return;

    if (account.role === "HOST") {
      loadHostData();
      loadHostPaymentSettings();
    } else {
      loadBookings();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  async function submitAuth(event) {
    event.preventDefault();
    setAuthError("");
    setBusy(true);

    try {
      const endpoint =
        authMode === "register"
          ? `${API}/auth/register`
          : `${API}/auth/login`;

      const payload =
        authMode === "register"
          ? authForm
          : {
              email: authForm.email,
              password: authForm.password
            };

      const response = await axios.post(endpoint, payload);

      sessionStorage.setItem(ACCOUNT_KEY, JSON.stringify(response.data));
      setAccount(response.data);
      setNotice(`Welcome, ${response.data.fullName}!`);
      setAuthError("");
    } catch (err) {
      setAuthError(
        errorMessage(
          err,
          "Could not connect to the backend. Make sure Spring Boot is running on port 8080."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  function continueAsGuest() {
    const guestAccount = {
      fullName: "Guest",
      email: "",
      role: "USER",
      guest: true
    };

    sessionStorage.setItem(ACCOUNT_KEY, JSON.stringify(guestAccount));
    setAccount(guestAccount);
    setNotice(
      "You're browsing as a guest. Allow location access to find nearby parking."
    );
    setAuthError("");
  }

  function signOut() {
    sessionStorage.removeItem(ACCOUNT_KEY);
    setAccount(null);
    setPosition(null);
    setNearbySlots([]);
    setBookings([]);
    setHostSlots([]);
    setQrFile(null);
    setQrImagePath("");
    setLatestReservation(null);
    setNotice("");
    setError("");
  }

  function locateMe() {
    setError("");
    setNotice("");

    if (!navigator.geolocation) {
      setError("This browser does not support location access.");
      return;
    }

    setBusy(true);

    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude
        };

        setPosition(pos);
        setBusy(false);

        if (account?.role === "HOST") {
          setLocationForm((f) => ({
            ...f,
            latitude: String(pos.latitude),
            longitude: String(pos.longitude)
          }));
        } else {
          searchNearby(pos, radius);
        }
      },
      (err) => {
        setBusy(false);
        setError(
          err.code === 1
            ? "Location permission was denied. Allow location access in your browser settings and try again."
            : "Could not get your location. Check device location services and try again."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000
      }
    );
  }

  async function searchNearby(pos = position, distance = radius) {
    if (!pos) {
      locateMe();
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await axios.get(`${API}/slots/nearby`, {
        params: {
          latitude: pos.latitude,
          longitude: pos.longitude,
          radiusKm: Number(distance)
        }
      });

      setNearbySlots(response.data);

      if (!response.data.length) {
        setNotice(
          `No vacant slots found within ${distance} km. Try a larger radius or check again later.`
        );
      }
    } catch (err) {
      setError(
        errorMessage(
          err,
          "Could not search nearby slots. Check that the backend is running and has the nearby search endpoint."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadBookings() {
    if (!account?.email) return;

    try {
      const response = await axios.get(
        `${API}/bookings/user/${encodeURIComponent(account.email)}`
      );
      setBookings(response.data);
    } catch (err) {
      setError(errorMessage(err, "Could not load your bookings."));
    }
  }

  async function loadHostData() {
    if (!account?.email) return;

    try {
      const [slotsResponse, bookingResponse] = await Promise.all([
        axios.get(
          `${API}/slots/host/${encodeURIComponent(account.email)}`
        ),
        axios.get(
          `${API}/bookings/host/${encodeURIComponent(account.email)}`
        )
      ]);

      setHostSlots(slotsResponse.data);
      setBookings(bookingResponse.data);
      setError("");
    } catch (err) {
      setError(
        errorMessage(
          err,
          "Could not load host data. Check that the host APIs are available."
        )
      );
    }
  }

  async function loadHostPaymentSettings() {
    if (!account?.email || account.role !== "HOST") return;

    try {
      const response = await axios.get(
        `${API}/payment-settings/${encodeURIComponent(account.email)}`
      );

      setQrImagePath(response.data.qrImagePath || "");
    } catch (err) {
      if (err?.response?.status === 404) {
        setQrImagePath("");
      } else {
        setError(
          errorMessage(err, "Could not load your payment QR settings.")
        );
      }
    }
  }

  async function uploadPaymentQr(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!account?.email || account.role !== "HOST") {
      setError("Only a host account can upload a payment QR image.");
      return;
    }

    if (!qrFile) {
      setError("Please select your payment QR image first.");
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

    if (!allowedTypes.includes(qrFile.type)) {
      setError("Please select a PNG, JPEG, or WebP image.");
      return;
    }

    if (qrFile.size > 5 * 1024 * 1024) {
      setError("The QR image must be 5 MB or smaller.");
      return;
    }

    const formData = new FormData();
    formData.append("hostEmail", account.email);
    formData.append("file", qrFile);

    setBusy(true);

    try {
      const response = await axios.post(
        `${API}/payment-settings/upload`,
        formData
      );

      setQrImagePath(response.data.qrImagePath || "");
      setQrFile(null);
      setNotice("Payment QR image uploaded successfully.");
      await loadHostPaymentSettings();
    } catch (err) {
      setError(
        errorMessage(
          err,
          "Could not upload the QR image. Check that the backend is running."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function reserve(slot) {
  if (!account || account.role !== "USER") return;

  if (account.guest) {
    setNotice("To reserve a parking space, please register or log in first.");
    return;
  }

  setBusy(true);
  setError("");
  setNotice("");

  try {
    const response = await axios.post(
      `${API}/bookings/${slot.id}`,
      null,
      {
        params: {
          userEmail: account.email
        }
      }
    );

      const reservation = {
        ...response.data,
        locationName: slot.locationName,
        address: slot.address
      };

      setLatestReservation(reservation);

      if (response.data.qrImagePath) {
        setNotice(
          `Reservation confirmed! Your booking ID is ${response.data.bookingCode}. Scan the host's QR code to pay.`
        );
      } else {
        setNotice(
          `Reservation confirmed! Your booking ID is ${response.data.bookingCode}. This host has not uploaded a payment QR image yet.`
        );
      }

      await Promise.all([
        searchNearby(position, radius),
        loadBookings()
      ]);
    } catch (err) {
      setError(
        errorMessage(
          err,
          "Could not reserve this slot. It may already have been taken."
        )
      );

      if (position) {
        await searchNearby(position, radius);
      }
    } finally {
      setBusy(false);
    }
  }

  async function addLocation(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        ...locationForm,
        latitude: Number(locationForm.latitude),
        longitude: Number(locationForm.longitude),
        hourlyRate: Number(locationForm.hourlyRate),
        numberOfSlots: Number(locationForm.numberOfSlots),
        hostEmail: account.email
      };

      const response = await axios.post(`${API}/slots/host`, payload);

      setNotice(
        `Parking location added successfully with ${response.data.length} slots.`
      );

      setLocationForm({
        locationName: "",
        address: "",
        latitude: "",
        longitude: "",
        hourlyRate: "30",
        numberOfSlots: "5"
      });

      await loadHostData();
    } catch (err) {
      setError(
        errorMessage(
          err,
          "Could not add location. Check all fields and backend status."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleSlot(slot) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await axios.put(`${API}/slots/${slot.id}`, {
        slotNumber: slot.slotNumber,
        occupied: !slot.occupied
      });

      setNotice(
        `${slot.slotNumber} marked ${
          slot.occupied ? "available" : "occupied"
        }.`
      );

      await loadHostData();
    } catch (err) {
      setError(errorMessage(err, "Could not update slot."));
    } finally {
      setBusy(false);
    }
  }

  const filteredSlots = useMemo(
    () =>
      nearbySlots.filter((slot) =>
        `${slot.slotNumber} ${slot.locationName} ${slot.address}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [nearbySlots, query]
  );

  const groupedSlots = useMemo(() => {
    const groups = new Map();

    for (const slot of filteredSlots) {
      const key = `${slot.locationName}|${slot.address}|${slot.hostEmail}`;

      if (!groups.has(key)) {
        groups.set(key, {
          name: slot.locationName || "Parking location",
          address: slot.address || "Address not provided",
          distanceKm: slot.distanceKm,
          hourlyRate: slot.hourlyRate ?? 30,
          latitude: slot.latitude,
          longitude: slot.longitude,
          slots: []
        });
      }

      groups.get(key).slots.push(slot);
    }

    return [...groups.values()];
  }, [filteredSlots]);

  if (!account) {
    return (
      <div className="auth-page">
        <div className="auth-showcase">
          <div className="brand auth-brand">
            <span className="brand-mark">
              <ParkingCircle size={30} />
            </span>
            <span>ParkSmart</span>
          </div>

          <div className="showcase-copy">
            <span className="eyebrow light-eyebrow">
              SMART PARKING PLATFORM
            </span>
            <h1>
              Parking made
              <br />
              <em>simple.</em>
            </h1>
            <p>
              Find a space nearby or turn your vacant parking into a useful
              space for your community.
            </p>

            <div className="showcase-points">
              <span>
                <CheckCircle2 size={17} /> Find nearby vacant slots
              </span>
              <span>
                <CheckCircle2 size={17} /> Easy reservations
              </span>
              <span>
                <CheckCircle2 size={17} /> Host your parking space
              </span>
            </div>
          </div>

          <div className="showcase-bottom">
            <span>
              <MapPin size={16} /> Your city. Your space. Less searching.
            </span>
          </div>
        </div>

        <div className="auth-content">
          <div className="auth-card">
            <p className="eyebrow">GET STARTED WITH PARKSMART</p>
            <h2>
              {authMode === "login"
                ? "Welcome back"
                : "Create your account"}
            </h2>
            <p className="muted">
              {authMode === "login"
                ? "Log in to find or manage parking."
                : "Choose how you want to use ParkSmart."}
            </p>

            <div className="auth-tabs">
              <button
                type="button"
                className={authMode === "login" ? "active" : ""}
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                }}
              >
                Login
              </button>

              <button
                type="button"
                className={authMode === "register" ? "active" : ""}
                onClick={() => {
                  setAuthMode("register");
                  setAuthError("");
                }}
              >
                Register
              </button>
            </div>

            <form onSubmit={submitAuth} className="form-stack">
              {authMode === "register" && (
                <label>
                  Full name
                  <input
                    required
                    autoComplete="name"
                    value={authForm.fullName}
                    onChange={(e) =>
                      setAuthForm({
                        ...authForm,
                        fullName: e.target.value
                      })
                    }
                    placeholder="Your full name"
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={authForm.email}
                  onChange={(e) =>
                    setAuthForm({
                      ...authForm,
                      email: e.target.value
                    })
                  }
                  placeholder="you@example.com"
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  minLength={6}
                  required
                  autoComplete={
                    authMode === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  value={authForm.password}
                  onChange={(e) =>
                    setAuthForm({
                      ...authForm,
                      password: e.target.value
                    })
                  }
                  placeholder="At least 6 characters"
                />
              </label>

              {authMode === "register" && (
                <fieldset className="role-choice">
                  <legend>How will you use ParkSmart?</legend>

                  <label
                    className={`role-option ${
                      authForm.role === "USER" ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="USER"
                      checked={authForm.role === "USER"}
                      onChange={() =>
                        setAuthForm({
                          ...authForm,
                          role: "USER"
                        })
                      }
                    />
                    <span className="role-icon">
                      <MapPin size={20} />
                    </span>
                    <span>
                      <strong>I'm a User</strong>
                      <small>Find and reserve nearby parking</small>
                    </span>
                  </label>

                  <label
                    className={`role-option ${
                      authForm.role === "HOST" ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="HOST"
                      checked={authForm.role === "HOST"}
                      onChange={() =>
                        setAuthForm({
                          ...authForm,
                          role: "HOST"
                        })
                      }
                    />
                    <span className="role-icon">
                      <Building2 size={20} />
                    </span>
                    <span>
                      <strong>I'm a Host</strong>
                      <small>List and manage parking spaces</small>
                    </span>
                  </label>
                </fieldset>
              )}

              {authError && (
                <div className="alert error">
                  <AlertCircle size={17} />
                  <span>{authError}</span>
                </div>
              )}

              <button className="primary-button full" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : authMode === "login"
                  ? "Log in"
                  : "Create account"}
              </button>
            </form>

            {authMode === "login" && (
              <>
                <div className="auth-divider">
                  <span>OR</span>
                </div>

                <button
                  type="button"
                  className="guest-button"
                  onClick={continueAsGuest}
                  disabled={busy}
                >
                  <LocateFixed size={17} /> Continue without login
                </button>
              </>
            )}

            <p className="small-note">
              By continuing, you agree to use accurate location and parking
              information.
            </p>
          </div>

          <p className="auth-footer">
            © {new Date().getFullYear()} ParkSmart · Smarter parking for
            everyone
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <ParkingCircle size={29} />
          </span>
          <span>ParkSmart</span>
        </div>

        <p className="menu-label">WORKSPACE</p>

        <a className="nav-item active" href="#dashboard">
          <LayoutDashboard size={18} />
          {account.role === "HOST" ? "Host dashboard" : "Find parking"}
        </a>

        <a className="nav-item" href="#bookings">
          <CalendarDays size={18} />
          {account.role === "HOST" ? "Reservations" : "My bookings"}
        </a>

        {account.role === "HOST" && (
          <>
            <a className="nav-item" href="#manage">
              <Building2 size={18} /> Manage my spaces
            </a>
            <a className="nav-item" href="#payment-settings">
              <CreditCard size={18} /> Payment QR settings
            </a>
          </>
        )}

        <div className="sidebar-bottom">
          <div className="account-chip">
            <span className="account-avatar">
              {account.fullName?.charAt(0)?.toUpperCase() || "U"}
            </span>

            <span className="account-info">
              <strong>{account.fullName}</strong>
              <small>
                {account.guest
                  ? "Guest browsing"
                  : account.role === "HOST"
                  ? "Parking host"
                  : "Parking user"}
              </small>
            </span>

            <button
              type="button"
              className="icon-button"
              title="Log out"
              onClick={signOut}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">SMART PARKING PLATFORM</p>
            <h1>
              {account.role === "HOST"
                ? "Host dashboard"
                : "Find parking near you"}
            </h1>
            <p className="muted">
              {account.role === "HOST"
                ? "Make your vacant parking spaces available to your community."
                : "Find a vacant space nearby and reserve with confidence."}
            </p>
          </div>

          <div className="topbar-actions">
            <span className="role-pill">
              <span className="status-dot" />
              {account.guest ? "GUEST" : account.role}
            </span>
            <button className="avatar-button" title={account.email}>
              <UserRound size={18} />
            </button>
          </div>
        </header>

        {error && (
          <div className="alert error page-alert">
            <AlertCircle size={17} />
            <span>{error}</span>
            <button className="dismiss" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}

        {notice && (
          <div className="alert success page-alert">
            <CheckCircle2 size={17} />
            <span>{notice}</span>
            <button className="dismiss" onClick={() => setNotice("")}>
              <X size={16} />
            </button>
          </div>
        )}

        {account.role === "USER" ? (
          <>
            <section className="stats-grid">
              <article className="stat-card">
                <span className="stat-icon green">
                  <CheckCircle2 />
                </span>
                <p>Vacant slots found</p>
                <h2>{nearbySlots.length}</h2>
                <span className="stat-foot">In your current search</span>
              </article>

              <article className="stat-card">
                <span className="stat-icon blue">
                  <CalendarDays />
                </span>
                <p>My bookings</p>
                <h2>{bookings.length}</h2>
                <span className="stat-foot">Saved reservations</span>
              </article>

              <article className="stat-card">
                <span className="stat-icon orange">
                  <MapPin />
                </span>
                <p>Search radius</p>
                <h2>{radius} km</h2>
                <span className="stat-foot">
                  From your current location
                </span>
              </article>
            </section>

            {latestReservation && (
              <section className="content-card payment-qr-panel">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">RECENT RESERVATION</span>
                    <h2>Parking payment</h2>
                    <p className="muted">
                      Reservation confirmed. Use the host's QR code to make
                      your payment.
                    </p>
                  </div>
                  <CreditCard size={24} />
                </div>

                <div className="booking-row">
                  <div className="booking-mark">
                    <CarFront size={19} />
                  </div>
                  <div className="booking-info">
                    <strong>{latestReservation.slotNumber}</strong>
                    <p>Booking ID: {latestReservation.bookingCode}</p>
                    {latestReservation.locationName && (
                      <p>{latestReservation.locationName}</p>
                    )}
                    {latestReservation.hourlyRate != null && (
                      <p>
                        Hourly rate: ₹{latestReservation.hourlyRate}
                      </p>
                    )}
                  </div>
                  <span className="open-badge">
                    {latestReservation.paymentStatus || "PENDING"}
                  </span>
                </div>

                {latestReservation.qrImagePath ? (
                  <div className="payment-qr-content">
                    <h3>Scan this QR code to pay the host</h3>
                    <img
                      className="payment-qr-image"
                      src={`http://localhost:8080${latestReservation.qrImagePath}`}
                      alt="Host payment QR code"
                    />
                    <p className="small-note">
                      After making the payment, keep your payment confirmation.
                      Your payment status remains pending until it is verified.
                    </p>
                  </div>
                ) : (
                  <div className="empty-state compact">
                    <CreditCard size={24} />
                    <strong>Payment QR not available</strong>
                    <p>
                      This host has not uploaded a payment QR code yet. Contact
                      the host for payment instructions.
                    </p>
                  </div>
                )}
              </section>
            )}

            <section className="content-card">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">DISCOVER</span>
                  <h2>Parking around you</h2>
                  <p className="muted">
                    Allow location access to find vacant spaces nearby.
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={locateMe}
                  disabled={busy}
                >
                  <LocateFixed size={17} />
                  {busy
                    ? "Finding location…"
                    : position
                    ? "Update my location"
                    : "Use my location"}
                </button>
              </div>

              {position && (
                <div className="location-readout">
                  <CheckCircle2 size={16} />
                  Location detected · {position.latitude.toFixed(5)},{" "}
                  {position.longitude.toFixed(5)}
                </div>
              )}

              <div className="search-controls">
                <div className="search-box">
                  <Search size={18} />
                  <input
                    placeholder="Search location or slot number"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                <label className="radius-select">
                  Radius
                  <select
                    value={radius}
                    onChange={(e) => {
                      setRadius(e.target.value);
                      if (position) {
                        searchNearby(position, e.target.value);
                      }
                    }}
                  >
                    <option value="2">2 km</option>
                    <option value="5">5 km</option>
                    <option value="10">10 km</option>
                    <option value="20">20 km</option>
                    <option value="50">50 km</option>
                  </select>
                </label>

                <button
                  className="secondary-button"
                  onClick={() => searchNearby()}
                  disabled={busy || !position}
                >
                  <RefreshCw size={16} /> Refresh
                </button>
              </div>

              <div className="map-layout">
                <div className="map-column">
                  <div className="map-heading">
                    <strong>
                      <MapPin size={16} /> Nearby map
                    </strong>
                    <span>OpenStreetMap</span>
                  </div>

                  <MapPanel
                    position={position}
                    locations={filteredSlots}
                  />

                  <p className="map-disclaimer">
                    Map provided by OpenStreetMap. Distances are calculated
                    from coordinates supplied by hosts.
                  </p>
                </div>

                <div className="nearby-column">
                  <div className="nearby-heading">
                    <h3>Available spaces</h3>
                    <span className="count-pill">{filteredSlots.length}</span>
                  </div>

                  {!position && (
                    <div className="empty-state">
                      <span className="empty-icon">
                        <LocateFixed size={24} />
                      </span>
                      <strong>Start with your location</strong>
                      <p>
                        Tap “Use my location” and allow browser permission to
                        discover nearby parking.
                      </p>
                    </div>
                  )}

                  {position && groupedSlots.length === 0 && (
                    <div className="empty-state">
                      <span className="empty-icon">
                        <CarFront size={24} />
                      </span>
                      <strong>No vacant slots found</strong>
                      <p>
                        Try a wider search radius, or check again after a host
                        lists a location.
                      </p>
                    </div>
                  )}

                  {groupedSlots.map((group, index) => (
                    <article
                      className="location-card"
                      key={`${group.name}-${group.address}-${index}`}
                    >
                      <div className="location-head">
                        <div className="location-icon">
                          <Building2 size={20} />
                        </div>
                        <div className="location-title">
                          <h3>{group.name}</h3>
                          <p>
                            <MapPin size={13} />
                            {group.address}
                          </p>
                        </div>
                      </div>

                      <div className="location-meta">
                        <span>
                          <Navigation size={14} />
                          {Number(group.distanceKm || 0).toFixed(2)} km away
                        </span>
                        <span>
                          <IndianRupee size={14} />
                          {group.hourlyRate}/hour
                        </span>
                        <span className="vacant-tag">
                          <CheckCircle2 size={13} />
                          {group.slots.length} vacant
                        </span>
                      </div>

                      <div className="vacant-slots">
                        {group.slots.map((slot) => (
                          <div className="vacant-slot" key={slot.id}>
                            <span className="slot-label">
                              <CarFront size={16} />
                              <strong>{slot.slotNumber}</strong>
                            </span>
                            <button
  type="button"
  className="primary-button small"
  disabled={busy}
  onClick={() => {
    if (account.guest) {
      signOut();
      setAuthMode("login");
      setAuthError("");
      setAuthForm((form) => ({
        ...form,
        password: ""
      }));
    } else {
      reserve(slot);
    }
  }}
>
  {account.guest ? "Log in to reserve" : "Reserve"}
</button>
                          </div>
                        ))}
                      </div>

                      <a
                        className="directions-link"
                        href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${position?.latitude}%2C${position?.longitude}%3B${group.latitude}%2C${group.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Navigation size={14} /> Get directions{" "}
                        <ExternalLink size={13} />
                      </a>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="content-card" id="bookings">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">YOUR ACTIVITY</span>
                  <h2>My recent bookings</h2>
                  <p className="muted">
                    Reservations linked to your account.
                  </p>
                </div>
                <Clock size={21} />
              </div>

              {bookings.length === 0 ? (
                <p className="empty-state compact">
                  No bookings yet. Search nearby parking and reserve a vacant
                  slot.
               
            </p>
          ) : (
            <div className="booking-list">
              {bookings.map((booking) => (
                <div className="booking-row" key={booking.id}>
                  <div className="booking-mark">
                    <CarFront size={19} />
                  </div>

                  <div className="booking-info">
                    <strong>{booking.slotNumber}</strong>

                    <p>
                      {booking.bookingCode} · {booking.userEmail} ·{" "}
                      {booking.bookingDate
                        ? new Date(booking.bookingDate).toLocaleString()
                        : ""}
                    </p>

                    <p>
                      Payment: {booking.paymentStatus || "PENDING"}
                    </p>

                    
{booking.paymentStatus !== "PAID" && (
  <button
    type="button"
    className="primary-button small"
    disabled={busy || paymentLoading}
    onClick={() => openPaymentQr(booking)}
  >
    {paymentLoading ? "Loading QR..." : "Pay Now"}
  </button>
)}
                  </div>

                  <span className="open-badge">{booking.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </>

 
        ) : (
          <>
            <section className="stats-grid">
              <article className="stat-card">
                <span className="stat-icon green">
                  <Building2 />
                </span>
                <p>My parking slots</p>
                <h2>{hostSlots.length}</h2>
                <span className="stat-foot">
                  Across your listed locations
                </span>
              </article>

              <article className="stat-card">
                <span className="stat-icon blue">
                  <CheckCircle2 />
                </span>
                <p>Available slots</p>
                <h2>{hostSlots.filter((slot) => !slot.occupied).length}</h2>
                <span className="stat-foot">Ready for reservations</span>
              </article>

              <article className="stat-card">
                <span className="stat-icon orange">
                  <CalendarDays />
                </span>
                <p>Reservations</p>
                <h2>{bookings.length}</h2>
                <span className="stat-foot">
                  For your parking spaces
                </span>
              </article>
            </section>

            <section className="content-card" id="payment-settings">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">PAYMENT SETTINGS</span>
                  <h2>Upload payment QR code</h2>
                  <p className="muted">
                    Users can scan this QR code after reserving one of your
                    parking spaces.
                  </p>
                </div>
                <CreditCard size={24} />
              </div>

              <form onSubmit={uploadPaymentQr} className="form-stack">
                <label>
                  Select payment QR image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) =>
                      setQrFile(e.target.files?.[0] || null)
                    }
                  />
                </label>

                <p className="small-note">
                  Accepted formats: PNG, JPEG, or WebP. Maximum size: 5 MB.
                </p>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={loadHostPaymentSettings}
                    disabled={busy}
                  >
                    <RefreshCw size={16} /> Refresh QR
                  </button>

                  <button
                    className="primary-button"
                    disabled={busy || !qrFile}
                  >
                    <Upload size={17} />
                    {busy ? "Uploading…" : "Upload payment QR"}
                  </button>
                </div>
              </form>

              {qrImagePath ? (
                <div className="payment-qr-content">
                  <h3>Your current payment QR</h3>
                  <img
                    className="payment-qr-image"
                    src={`http://localhost:8080${qrImagePath}`}
                    alt="Your payment QR code"
                  />
                  <p className="small-note">
                    This QR code is shown to users after they reserve your
                    parking space.
                  </p>
                </div>
              ) : (
                <p className="empty-state compact">
                  No payment QR has been uploaded yet.
                </p>
              )}
            </section>

            <section className="content-card">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">GROW YOUR SPACE</span>
                  <h2>List a parking location</h2>
                  <p className="muted">
                    Add your location so nearby users can find vacant spaces.
                  </p>
                </div>
              </div>

              <form onSubmit={addLocation} className="form-grid">
                <label>
                  Location name
                  <input
                    required
                    value={locationForm.locationName}
                    onChange={(e) =>
                      setLocationForm({
                        ...locationForm,
                        locationName: e.target.value
                      })
                    }
                    placeholder="e.g. City Centre Parking"
                  />
                </label>

                <label>
                  Full address
                  <input
                    required
                    value={locationForm.address}
                    onChange={(e) =>
                      setLocationForm({
                        ...locationForm,
                        address: e.target.value
                      })
                    }
                    placeholder="Street, area, city"
                  />
                </label>

                <label>
                  Latitude
                  <input
                    type="number"
                    required
                    step="any"
                    min="-90"
                    max="90"
                    value={locationForm.latitude}
                    onChange={(e) =>
                      setLocationForm({
                        ...locationForm,
                        latitude: e.target.value
                      })
                    }
                    placeholder="17.3850"
                  />
                </label>

                <label>
                  Longitude
                  <input
                    type="number"
                    required
                    step="any"
                    min="-180"
                    max="180"
                    value={locationForm.longitude}
                    onChange={(e) =>
                      setLocationForm({
                        ...locationForm,
                        longitude: e.target.value
                      })
                    }
                    placeholder="78.4867"
                  />
                </label>

                <label>
                  Hourly price (₹)
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.5"
                    value={locationForm.hourlyRate}
                    onChange={(e) =>
                      setLocationForm({
                        ...locationForm,
                        hourlyRate: e.target.value
                      })
                    }
                  />
                </label>

                <label>
                  Number of slots
                  <input
                    type="number"
                    required
                    min="1"
                    max="200"
                    value={locationForm.numberOfSlots}
                    onChange={(e) =>
                      setLocationForm({
                        ...locationForm,
                        numberOfSlots: e.target.value
                      })
                    }
                  />
                </label>

                <div className="form-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={locateMe}
                    disabled={busy}
                  >
                    <LocateFixed size={16} /> Use my current location
                  </button>

                  <button className="primary-button" disabled={busy}>
                    <PlusCircle size={17} />
                    {busy ? "Saving…" : "Publish parking location"}
                  </button>
                </div>
              </form>

              <p className="small-note">
                The GPS button fills in your current coordinates. Make sure
                they point to the actual parking entrance before publishing.
              </p>
            </section>

            <section className="content-card" id="manage">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">YOUR LISTINGS</span>
                  <h2>Manage my parking spaces</h2>
                  <p className="muted">
                    Update availability as spaces become occupied or vacant.
                  </p>
                </div>

                <button
                  className="secondary-button"
                  onClick={loadHostData}
                >
                  <RefreshCw size={16} /> Refresh
                </button>
              </div>

              {hostSlots.length === 0 ? (
                <p className="empty-state compact">
                  You haven't added any parking locations yet.
                </p>
              ) : (
                <div className="host-slot-grid">
                  {hostSlots.map((slot) => (
                    <article
                      className={`host-slot ${
                        slot.occupied ? "is-occupied" : "is-available"
                      }`}
                      key={slot.id}
                    >
                      <span className="host-slot-icon">
                        <CarFront size={21} />
                      </span>
                      <strong>{slot.slotNumber}</strong>
                      <span className="host-location-name">
                        {slot.locationName || "Parking space"}
                      </span>
                      <small>
                        {slot.occupied ? "Occupied" : "Available"}
                      </small>
                      <button
                        className="secondary-button small"
                        disabled={busy}
                        onClick={() => toggleSlot(slot)}
                      >
                        Mark {slot.occupied ? "available" : "occupied"}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="content-card" id="bookings">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">RESERVATIONS</span>
                  <h2>Bookings for my locations</h2>
                  <p className="muted">
                    Reservations associated with your parking spaces.
                  </p>
                </div>
              </div>

              {bookings.length === 0 ? (
                <p className="empty-state compact">No reservations yet.</p>
              ) : (
                <div className="booking-list">
                  
{bookings.map((booking) => (
  <div className="booking-row" key={booking.id}>
    <div className="booking-mark">
      <CarFront size={19} />
    </div>

    <div className="booking-info">
      <strong>{booking.slotNumber}</strong>

      <p>
        {booking.bookingCode} · {booking.userEmail} ·{" "}
        {booking.bookingDate
          ? new Date(booking.bookingDate).toLocaleString()
          : ""}
      </p>

      <p>
        Payment: {booking.paymentStatus || "PENDING"}
      </p>

     

{booking.paymentStatus !== "PAID" && (
  <button
    type="button"
    className="primary-button small"
    disabled={busy}
    onClick={async () => {
      const confirmed = window.confirm(
        "Have you checked that the money was actually received?"
      );

      if (!confirmed) return;

      try {
        await axios.put(
          `${API}/bookings/${booking.id}/verify-payment`,
          null,
          { params: { hostEmail: account.email } }
        );

        setNotice("Payment confirmed successfully.");
        await loadHostData();
      } catch (err) {
        setError(errorMessage(err, "Could not confirm payment."));
      }
    }}
  >
    Confirm Payment Received
  </button>
)}


    </div>

    <span className="open-badge">{booking.status}</span>
  </div>
))}

                </div>
              )}
            </section>
          </>
        )}

        <footer className="app-footer">
          ParkSmart · React + Spring Boot + MySQL
          <span>Find a space. Park with confidence.</span>
        </footer>
      </main>
    </div>
  );
}