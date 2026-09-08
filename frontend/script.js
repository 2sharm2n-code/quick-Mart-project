// frontend/script.js
const API_URL = '/api';

const jobList = document.getElementById('job-list');
if (jobList) {
    loadJobs();
}

const applicationForm = document.getElementById('application-form');
if (applicationForm) {
    applicationForm.addEventListener('submit', submitApplication);
}

async function loadJobs() {
    try {
        const response = await fetch(`${API_URL}/jobs`);
        if (!response.ok) throw new Error('Failed to fetch jobs');
        const jobs = await response.json();
        jobList.innerHTML = '';

        if (jobs.length === 0) {
            jobList.innerHTML = '<p>No jobs currently available.</p>';
            return;
        }

        jobs.forEach(job => {
            const card = document.createElement('div');
            card.className = 'job-card';
            card.innerHTML = `
                <h3>${job.title}</h3>
                <div class="job-meta">
                    <span>📍 ${job.location}</span> |
                    <span>💼 ${job.type}</span>
                </div>
                <p>${job.description.substring(0, 100)}...</p>
                <a href="apply.html?id=${job.id}&title=${encodeURIComponent(job.title)}" class="btn-apply">Apply Now</a>
            `;
            jobList.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        jobList.innerHTML = '<p style="color:red">Error loading jobs. Is the server running?</p>';
    }
}

async function submitApplication(e) {
    e.preventDefault();
    const messageDiv = document.getElementById('message');
    messageDiv.innerText = 'Submitting...';
    messageDiv.className = '';

    const formData = {
        job_id: document.getElementById('job-id').value,
        full_name: document.getElementById('full_name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        resume_link: document.getElementById('resume_link').value,
        cover_letter: document.getElementById('cover_letter').value
    };

    try {
        const response = await fetch(`${API_URL}/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
            messageDiv.innerText = '✅ Application submitted successfully!';
            messageDiv.className = 'success';
            document.getElementById('application-form').reset();
        } else {
            throw new Error(result.error || 'Submission failed');
        }
    } catch (error) {
        messageDiv.innerText = '❌ ' + error.message;
        messageDiv.className = 'error';
    }
}
