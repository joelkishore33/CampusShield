# CampusShield

**An AI-assisted campus safety monitoring prototype that detects potential weapons in video, validates detections across multiple frames, and sends evidence to a review dashboard.**

<p align="center">
  <a href="https://youtu.be/L_-J9z7eYP8">
    <img src="https://img.youtube.com/vi/L_-J9z7eYP8/maxresdefault.jpg" alt="CampusShield video demonstration" width="820">
  </a>
</p>

<p align="center">
  <strong><a href="https://youtu.be/L_-J9z7eYP8">Watch the CampusShield Demo</a></strong>
  &nbsp;•&nbsp;
  <a href="https://github.com/joelkishore33/CampusShield">View the Repository</a>
  &nbsp;•&nbsp;
  <a href="https://www.linkedin.com/in/joel-kishore-b53a982a7">LinkedIn</a>
</p>

> CampusShield is an educational hackathon prototype. It is not a production security system and should not replace trained personnel, emergency services, or human judgment.

---

## Inspiration

CampusShield began as my first hackathon project at **HooHacks 2026**.

I originally planned to participate with three other first-year computer science students. Two teammates were unable to register, and the remaining teammate joined another group, leaving me to complete the project independently. I still wanted to participate because the hackathon seemed like an opportunity to learn unfamiliar technologies and turn concepts from class into a complete application.

At the time, I was studying object detection and other computer-vision techniques. I was also seeing reports of serious safety incidents at colleges near mine. That led me to explore whether computer vision could make existing camera systems more proactive—helping identify a possible threat as it develops instead of only preserving footage after an incident.

---

## What CampusShield Does

CampusShield monitors a camera or video source for potential weapons, currently focusing on:

- **Knives**
- **Guns**

When the model detects a target object, the system does not immediately treat a single prediction as a confirmed threat. Instead, it tracks the object across frames and evaluates the detection using confidence, consistency, and event-duration requirements.

Once an event satisfies the configured conditions, CampusShield:

1. Marks the event for review.
2. Saves the strongest supporting frame.
3. Saves a short video clip.
4. Uploads the evidence to Supabase Storage.
5. Creates or updates an alert record in the Supabase database.
6. Displays the event in a web dashboard for human review.

---

## Demo

### [Watch the CampusShield demonstration on YouTube](https://youtu.be/L_-J9z7eYP8)

The demo shows the computer-vision pipeline detecting a potential weapon and connecting the detection to the broader CampusShield monitoring experience.

---

## Key Features

- Custom **YOLOv8** weapon-detection model
- Real-time video processing with **OpenCV**
- Persistent object tracking with **ByteTrack**
- Multi-frame alert validation to reduce one-frame false alarms
- Separate average-confidence and peak-confidence requirements
- Dynamic processing rate:
  - Lower frame rate during normal monitoring
  - Higher frame rate while evaluating a possible threat
- Automatic capture of the strongest evidence frame
- Automatic creation of an incident video clip
- Evidence storage and alert records through **Supabase**
- **Next.js** dashboard for viewing and reviewing alerts
- Authentication, user profiles, event history, and administrative routes
- Operator notes and pending-alert review components
- Experimental Presage integration wrapper for future contactless vital-sign analysis

---

## How It Works

```text
Camera or Video Source
          |
          v
   OpenCV Frame Capture
          |
          v
  YOLOv8 Object Detection
          |
          v
 ByteTrack Object Tracking
          |
          v
 Confidence + Multi-Frame Validation
          |
       +--+------------------+
       |                     |
       v                     v
Continue Monitoring     Confirmed Alert
                              |
                              v
                  Best Frame + Video Clip
                              |
                              v
                  Supabase Storage + Database
                              |
                              v
                   Next.js Review Dashboard
```

### Detection and event validation

CampusShield uses multiple checks before confirming an event:

- The predicted class must be a configured target such as `knife` or `gun`.
- The bounding box must pass basic size and shape checks.
- The confidence must exceed the event-entry threshold.
- The object must appear across a minimum number of relevant frames.
- The event's average confidence must exceed a configured threshold.
- Its peak confidence must also exceed a configured threshold.

This design helps prevent a single blurry or uncertain frame from automatically becoming a confirmed alert.

### Adaptive processing

The monitor runs at a lower target frame rate during ordinary operation. When a possible threat enters the alert-check state, it increases the target processing rate so the event can be evaluated with more visual evidence.

### Evidence preservation

For each qualifying event, the application can save:

- The frame with the strongest detection
- A short incident clip
- The detected object label
- Average confidence
- Peak confidence
- Camera identifier
- Event timestamp
- Review status

The evidence is uploaded to Supabase and connected to an alert record for review in the frontend.

---

## Technology Stack

### Computer-vision pipeline

| Technology | Purpose |
|---|---|
| Python | Core detection and event-processing logic |
| Ultralytics YOLOv8 | Weapon detection and tracking integration |
| OpenCV | Video capture, resizing, annotation, and clip generation |
| ByteTrack | Persistent object tracking across frames |
| python-dotenv | Local environment configuration |
| Supabase Python client | Evidence uploads and alert database operations |

### Web application

| Technology | Purpose |
|---|---|
| Next.js | Full-stack dashboard framework |
| React | User-interface components |
| TypeScript | Typed frontend development |
| Tailwind CSS | Dashboard styling |
| Supabase SSR | Server-side authentication support |
| Supabase JavaScript client | Database, authentication, and realtime functionality |

---

## Repository Structure

```text
CampusShield/
├── frontend/
│   ├── app/
│   │   ├── admin/users/          # Administrative user management
│   │   ├── alerts/[eventId]/     # Individual alert review pages
│   │   ├── auth/                 # Authentication routes
│   │   ├── dashboard/            # Main monitoring dashboard
│   │   ├── forgot-password/      # Password recovery
│   │   ├── history/              # Previous alert history
│   │   ├── profile/              # User profile
│   │   └── update-password/      # Password update flow
│   ├── components/
│   │   ├── DashboardRealtimeNotifier.tsx
│   │   ├── OperatorNotesEditor.tsx
│   │   └── PendingAlertsPanel.tsx
│   ├── lib/supabase/             # Supabase browser/server helpers
│   └── package.json
├── Knives/                       # Training or test media
├── extract_video_frames.py       # Video-frame extraction utility
├── presage_client.py             # Experimental Presage wrapper
├── yolo_image_test.py            # Image-based model testing
├── yolo_video_monitor.py         # Main monitoring pipeline
└── package.json                  # Root Supabase JavaScript dependencies
```

---

## Getting Started

## 1. Clone the repository

```bash
git clone https://github.com/joelkishore33/CampusShield.git
cd CampusShield
```

## 2. Configure the Python environment

Create and activate a virtual environment:

```bash
python -m venv .venv
```

macOS or Linux:

```bash
source .venv/bin/activate
```

Windows:

```bash
.venv\Scripts\activate
```

Install the Python packages used by the monitoring pipeline:

```bash
pip install ultralytics opencv-python python-dotenv supabase
```

## 3. Add environment variables

Create a private `.env.local` file in the repository root:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PRESAGE_API_KEY=your_presage_api_key
PRESAGE_MODE=sdk
```

The Presage integration is currently experimental. The existing wrapper returns mock data while the full SDK or API integration is unfinished.

**Never commit `.env.local`, API keys, service-role keys, or other credentials to GitHub.**

## 4. Configure the model and video source

In `yolo_video_monitor.py`, update:

```python
MODEL_PATH = "models/your_model.pt"
VIDEO_SOURCE = "path/to/your/video.mp4"
```

For a webcam, set:

```python
VIDEO_SOURCE = 0
```

You can also adjust the target classes and alert thresholds:

```python
TARGET_LABELS = {"knife", "gun"}
MODEL_CONF_THRESHOLD = 0.12
ENTER_ALERT_THRESHOLD = 0.15
FINAL_ALERT_AVG_THRESHOLD = 0.15
FINAL_ALERT_PEAK_THRESHOLD = 0.22
MIN_CONFIRMATION_FRAMES = 2
```

The current values are prototype testing settings and should be recalibrated before any serious deployment.

## 5. Run the monitoring pipeline

```bash
python yolo_video_monitor.py
```

Press `q` to close the monitoring window.

---

## Running the Frontend

Move into the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create `frontend/.env.local` with the Supabase values expected by the frontend:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Supabase Setup

CampusShield expects:

- A storage bucket named `evidence`
- An `alerts` database table
- Authentication enabled for dashboard users
- Appropriate Row Level Security policies
- Policies that restrict evidence and alert access to authorized users

The Python pipeline currently writes alert data such as:

```text
event_id
camera_id
status
detected_object
average_confidence
peak_confidence
event_timestamp
best_frame_url
footage_clip_url
```

Never expose the Supabase service-role key in browser code. It should only be used by trusted backend processes.

---

## Current Project Status

CampusShield is a functional educational prototype created during a hackathon and expanded into an end-to-end system.

The repository currently demonstrates:

- A working YOLOv8 video-monitoring pipeline
- Object tracking and event-state management
- Evidence-frame and incident-clip generation
- Supabase upload and alert-record logic
- A Next.js review dashboard
- Realtime dashboard and pending-alert components
- Authentication and account-management routes

The Presage wrapper is still a placeholder integration and currently produces mock data rather than performing full production vital-sign analysis.

---

## Performance

During initial project testing, the custom detection model achieved approximately **80% precision**.

```text
Precision = True Positives / (True Positives + False Positives)
```

Precision was a meaningful metric for this project because too many false alerts would make the system difficult for an operator to trust.

A more complete future evaluation should also report:

- Recall
- F1 score
- Mean average precision
- False alerts per hour
- End-to-end alert latency
- Performance by lighting condition
- Performance by camera angle and distance

---

## Challenges and Lessons Learned

The most important lesson from CampusShield was that a functioning machine-learning model is not automatically a useful product.

The difficult parts included:

- Deciding when a prediction should become an event
- Reducing alerts caused by isolated detections
- Tracking the same object across multiple frames
- Saving evidence without interrupting inference
- Connecting the Python pipeline to the database
- Designing a dashboard that makes alerts understandable
- Building an end-to-end application independently after the original team changed

Completing the project alone gave me experience moving from an open-ended idea to a functioning system involving machine learning, backend storage, and frontend development.

---

## Limitations

- The model can produce false positives and false negatives.
- Performance depends on lighting, camera quality, distance, angle, and occlusion.
- Object detection cannot determine a person's intent.
- The current confidence values are permissive prototype settings.
- The model has not been validated for production security use.
- The training and evaluation datasets may not represent all environments or populations.
- The Presage integration is not yet connected to a complete production API workflow.
- Privacy, retention, access-control, and legal requirements would need substantial review before deployment.

CampusShield should support human decision-making, not make autonomous accusations or emergency decisions.

---

## Future Improvements

- Expand and diversify the weapon-detection dataset
- Publish a reproducible model-evaluation report
- Tune thresholds using a separate validation set
- Measure false alerts per hour
- Add email, SMS, or emergency-dispatch integrations
- Add configurable cameras and detection policies
- Support multiple simultaneous camera feeds
- Improve object tracking through occlusion
- Add role-based permissions and audit logs
- Encrypt and automatically expire stored evidence
- Complete the Presage API or SDK integration
- Containerize the application with Docker
- Add automated tests and continuous integration
- Deploy the dashboard and backend securely

---

## Responsible Use

CampusShield is intended as an educational exploration of computer vision and incident-review software.

Any real-world deployment would require:

- Human oversight
- Extensive independent testing
- Privacy protections
- Strict access controls
- Secure credential management
- Bias and performance analysis
- Legal and institutional review
- Clear escalation and error-handling procedures

---

## Author

**Joel Kishore**

- GitHub: [joelkishore33](https://github.com/joelkishore33)
- LinkedIn: [Joel Kishore](https://www.linkedin.com/in/joel-kishore-b53a982a7)
- Project demo: [YouTube](https://youtu.be/L_-J9z7eYP8)

---

## License

No license is currently included in the repository. Add a license before presenting the project as open source. The [MIT License](https://choosealicense.com/licenses/mit/) is a common option for portfolio and educational projects.
