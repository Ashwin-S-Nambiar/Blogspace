let postsArray = [];
const titleInput = document.getElementById("post-title");
const bodyInput = document.getElementById("post-body");
const form = document.getElementById("new-post");
const blogList = document.getElementById("blog-list");
const submitButton = form.querySelector("button");

function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(new Date(date));
}

function setLoading(isLoading) {
    const buttonText = submitButton.querySelector('.button-text');
    if (isLoading) {
        buttonText.textContent = 'Publishing...';
        submitButton.disabled = true;
        if (!submitButton.querySelector('.loading')) {
            const loader = document.createElement('span');
            loader.className = 'loading';
            submitButton.appendChild(loader);
        }
    } else {
        buttonText.textContent = 'Publish Post';
        submitButton.disabled = false;
        const loader = submitButton.querySelector('.loading');
        if (loader) loader.remove();
    }
}

function renderPosts() {
    if (postsArray.length === 0) {
        blogList.innerHTML = `
            <div class="empty-state">
                <h3>No posts yet</h3>
                <p>Be the first to share your thoughts!</p>
            </div>
        `;
        return;
    }

    let html = "";
    for (let post of postsArray) {
        html += `
            <article class="post">
                <h3>${post.title}</h3>
                <p>${post.body}</p>
                <div class="post-meta">
                    Posted on ${formatDate(post.createdAt || new Date())}
                </div>
            </article>
        `;
    }
    blogList.innerHTML = html;
}

// Initial fetch with loading state
blogList.innerHTML = '<div class="empty-state"><span class="loading"></span></div>';
fetch("https://apis.scrimba.com/jsonplaceholder/posts")
    .then(res => res.json())
    .then(data => {
        postsArray = data.slice(0, 5).map(post => ({
            ...post,
            createdAt: new Date().toISOString()
        }));
        renderPosts();
    })
    .catch(error => {
        blogList.innerHTML = `
            <div class="empty-state">
                <h3>Error loading posts</h3>
                <p>Please try again later</p>
            </div>
        `;
        console.error('Error:', error);
    });

    function showError(inputElement, errorElement) {
        inputElement.classList.add('error');
        errorElement.classList.add('show');
    }

    function hideError(inputElement, errorElement) {
        inputElement.classList.remove('error');
        errorElement.classList.remove('show');
    }

    function showAlert(message) {
        const alertContainer = document.querySelector('.alert-container');
        const alert = document.createElement('div');
        alert.className = 'alert';
        alert.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            ${message}
        `;
        alertContainer.appendChild(alert);

        // Remove alert after 3 seconds
        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transform = 'translateX(100%) scale(0.5)';
            setTimeout(() => alert.remove(), 300);
        }, 3000);
    }

    // Input validation handlers
    titleInput.addEventListener('input', () => {
        const errorElement = document.getElementById('title-error');
        if (titleInput.value.trim()) {
            hideError(titleInput, errorElement);
        }
    });

    bodyInput.addEventListener('input', () => {
        const errorElement = document.getElementById('body-error');
        if (bodyInput.value.trim()) {
            hideError(bodyInput, errorElement);
        }
    });

    form.addEventListener("submit", function(e) {
        e.preventDefault();
        let hasError = false;
        const postTitle = titleInput.value.trim();
        const postBody = bodyInput.value.trim();

        // Validate title
        if (!postTitle) {
            showError(titleInput, document.getElementById('title-error'));
            hasError = true;
        }

        // Validate content
        if (!postBody) {
            showError(bodyInput, document.getElementById('body-error'));
            hasError = true;
        }

        if (hasError) {
            showAlert('Please fill in all required fields');
            return;
        }

        setLoading(true);

        const data = {
            title: postTitle,
            body: postBody,
            createdAt: new Date().toISOString()
        };

        fetch("https://apis.scrimba.com/jsonplaceholder/posts", {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                "Content-Type": "application/json"
            }
        })
            .then(res => res.json())
            .then(post => {
                postsArray.unshift(post);
                renderPosts();
                titleInput.value = "";
                bodyInput.value = "";
                setLoading(false);
            })
            .catch(error => {
                console.error('Error:', error);
                setLoading(false);
                showAlert('Failed to publish post. Please try again.');
            });
    });

// Add input animations
const inputs = document.querySelectorAll('input, textarea');
inputs.forEach(input => {
    input.addEventListener('focus', () => {
        input.parentElement.classList.add('focused');
    });
    input.addEventListener('blur', () => {
        input.parentElement.classList.remove('focused');
    });
});

// Set current year
document.getElementById('current-year').textContent = new Date().getFullYear();