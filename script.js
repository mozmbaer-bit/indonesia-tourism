document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('addBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    const captionInput = document.getElementById('captionInput');
    const qualitySelect = document.getElementById('qualitySelect');
    const list = document.querySelector('.gallery');
    const container = document.querySelector('.container');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const clickSound = document.getElementById('clickSound');
    const clearBtn = document.getElementById('clearBtn');
    const darkModeBtn = document.getElementById('darkModeBtn');
    const lockBtn = document.getElementById('lockBtn');
    const exportBtn = document.getElementById('exportBtn');
    const notifyBtn = document.getElementById('notifyBtn');
    const infoBtn = document.getElementById('infoBtn');
    const shareAppBtn = document.getElementById('shareAppBtn');
    const cropModal = document.getElementById('cropModal');
    const imageToCrop = document.getElementById('imageToCrop');
    const confirmCropBtn = document.getElementById('confirmCropBtn');
    const cancelCropBtn = document.getElementById('cancelCropBtn');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const infoModal = document.getElementById('infoModal');
    const closeInfo = document.querySelector('.close-info');
    const langSelect = document.getElementById('langSelect');
    let cropper = null;
    let currentFileName = '';
    let currentFilter = 'none';

    // --- تحميل الإعدادات من config.js ---
    if (window.siteConfig) {
        // تحديث الرأس
        document.getElementById('headerTitle').textContent = window.siteConfig.general.title;
        document.getElementById('headerSubtitle').textContent = window.siteConfig.general.subtitle;

        // تحديث الخبر المميز
        document.getElementById('newsBannerImage').src = window.siteConfig.featuredNews.image;
        document.getElementById('newsBannerTag').textContent = window.siteConfig.featuredNews.tag;
        document.getElementById('newsBannerTitle').textContent = window.siteConfig.featuredNews.title;
        document.getElementById('newsBannerSummary').textContent = window.siteConfig.featuredNews.summary;

        // تحديث تاريخ آخر تعديل (مبدئياً بالعربية)
        if (window.siteConfig.general.lastUpdated && document.getElementById('lastUpdateDisplay')) {
            document.getElementById('lastUpdateDisplay').textContent = '🕒 آخر تحديث: ' + window.siteConfig.general.lastUpdated;
        }
    }

    // --- دوال مساعدة (Helper Functions) ---

    // دالة لتشغيل المؤثر الصوتي
    const playSound = () => {
        clickSound.currentTime = 0;
        clickSound.play().catch(() => {}); // تجاهل الأخطاء (مثل منع المتصفح للتشغيل التلقائي)
    };

    // دالة لتشفير النصوص (SHA-256) لحماية كلمة المرور
    const hashPassword = async (string) => {
        const utf8 = new TextEncoder().encode(string);
        const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((bytes) => bytes.toString(16).padStart(2, '0')).join('');
    };

    // دالة لإرسال إشعار للمستخدم
    const sendNotification = (title, body) => {
        if (Notification.permission === "granted") {
            new Notification(title, {
                body: body,
                icon: 'https://cdn-icons-png.flaticon.com/512/2550/2550264.png' // أيقونة الدرع
            });
        }
    };

    // دالة لضغط الصورة وتقليل حجمها (Resize & Compress)
    const compressImage = (base64Str, maxWidth = 800, quality = 0.7) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // تغيير الأبعاد إذا كانت الصورة كبيرة جداً
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // --- إضافة العلامة المائية ---
                const watermarkText = "Wonderful Indonesia 🇮🇩";
                const fontSize = Math.max(20, width * 0.05); // حجم خط نسبي (5% من العرض)
                ctx.font = `bold ${fontSize}px 'Cairo', sans-serif`;
                ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; // لون أبيض شبه شفاف
                ctx.textAlign = "right";
                ctx.textBaseline = "bottom";
                
                // إضافة ظل للنص لضمان الوضوح على الخلفيات المختلفة
                ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                // رسم النص في الزاوية اليمنى السفلية
                const margin = width * 0.03;
                ctx.fillText(watermarkText, width - margin, height - margin);
                
                // تحويل الصورة إلى JPEG بجودة 70% لتقليل الحجم
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        });
    };

    // دالة لحفظ الصور الحالية في LocalStorage
    const saveImages = () => {
        const items = [];
        document.querySelectorAll('.gallery li').forEach(li => {
            items.push({
                src: li.querySelector('img').src,
                caption: li.querySelector('.caption').textContent,
                date: li.querySelector('.date-time').textContent,
                likes: parseInt(li.querySelector('.like-count').textContent) || 0
            });
        });

        try {
            localStorage.setItem('myGallery', JSON.stringify(items));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                alert('عذراً، مساحة التخزين ممتلئة! 🚫\nلقد وصلت للحد الأقصى للتخزين المحلي في المتصفح.\nيرجى حذف بعض الصور القديمة لإضافة صور جديدة.');
            } else {
                console.error('حدث خطأ غير متوقع أثناء الحفظ:', e);
            }
        }
    };

    // دالة لإنشاء عنصر القائمة مع الصورة وزر الحذف
    const createGalleryItem = (src, captionText, dateText, likes = 0, animate = false) => {
        const li = document.createElement('li');
        
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'image-wrapper';

        const img = document.createElement('img');
        img.src = src;
        img.alt = 'صورة المعرض';

        // إنشاء حاوية الأزرار
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions-container';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '&times;'; // علامة X
        deleteBtn.title = 'حذف الصورة';

        const likeBtn = document.createElement('button');
        likeBtn.className = 'like-btn';
        likeBtn.innerHTML = '❤️ <span class="like-count">' + likes + '</span>';
        likeBtn.title = 'إعجاب';

        const shareBtn = document.createElement('button');
        shareBtn.className = 'share-btn';
        shareBtn.innerHTML = '&#10150;'; // رمز سهم المشاركة
        shareBtn.title = 'مشاركة عبر واتساب';

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';
        downloadBtn.innerHTML = '&#11015;'; // رمز سهم لأسفل
        downloadBtn.title = 'تحميل الصورة';

        const printBtn = document.createElement('button');
        printBtn.className = 'print-btn';
        printBtn.innerHTML = '&#128424;'; // رمز الطابعة
        printBtn.title = 'طباعة الصورة';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.innerHTML = '✏️'; // رمز القلم
        editBtn.title = 'تعديل الوصف';

        const fbBtn = document.createElement('button');
        fbBtn.className = 'fb-btn';
        fbBtn.innerHTML = 'f';
        fbBtn.title = 'مشاركة على فيسبوك';

        const twitterBtn = document.createElement('button');
        twitterBtn.className = 'twitter-btn';
        twitterBtn.innerHTML = '𝕏';
        twitterBtn.title = 'مشاركة على تويتر';

        const linkedinBtn = document.createElement('button');
        linkedinBtn.className = 'linkedin-btn';
        linkedinBtn.innerHTML = 'in';
        linkedinBtn.title = 'مشاركة على LinkedIn';

        const telegramBtn = document.createElement('button');
        telegramBtn.className = 'telegram-btn';
        telegramBtn.innerHTML = '✈️';
        telegramBtn.title = 'مشاركة على Telegram';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.innerHTML = '📋';
        copyBtn.title = 'نسخ رابط الصورة';

        const caption = document.createElement('div');
        caption.className = 'caption';
        caption.textContent = captionText;

        const dateElem = document.createElement('div');
        dateElem.className = 'date-time';
        dateElem.textContent = dateText;

        // إضافة الأزرار للحاوية
        actionsDiv.appendChild(likeBtn);
        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(shareBtn);
        actionsDiv.appendChild(fbBtn);
        actionsDiv.appendChild(twitterBtn);
        actionsDiv.appendChild(linkedinBtn);
        actionsDiv.appendChild(telegramBtn);
        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(downloadBtn);
        actionsDiv.appendChild(printBtn);
        actionsDiv.appendChild(deleteBtn);

        imageWrapper.appendChild(img);
        imageWrapper.appendChild(actionsDiv);
        
        li.appendChild(imageWrapper);
        li.appendChild(caption);
        li.appendChild(dateElem);

        if (animate) {
            li.classList.add('fade-in');
        }
        return li;
    };

    // دالة لإكمال عملية الرفع بعد القص
    const finalizeUpload = async (imageUrl, fileName) => {
        // ضغط الصورة قبل العرض والحفظ لتوفير المساحة
        const quality = parseFloat(qualitySelect.value);
        imageUrl = await compressImage(imageUrl, 800, quality);

        // استخدام النص المدخل أو اسم الملف كعنوان افتراضي
        const captionText = captionInput.value.trim() || fileName;
        const dateText = new Date().toLocaleString('ar-EG'); // التاريخ الحالي
        const listItem = createGalleryItem(imageUrl, captionText, dateText, 0, true);
        list.appendChild(listItem);
        saveImages();

        // إرسال إشعار عند اكتمال الرفع
        sendNotification('تمت إضافة الوجهة! 📸', `تم حفظ الصورة: ${captionText}`);
        
        // إخفاء الشريط بعد الانتهاء
        setTimeout(() => {
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
        }, 500);

        listItem.scrollIntoView({ behavior: 'smooth' });
    };

    // دالة لمعالجة الملف المرفوع (سواء عبر الزر أو السحب)
    const processFile = (file) => {
        // التحقق من أن الملف هو صورة
        if (!file.type.startsWith('image/')) {
            alert('عذراً، هذا الملف ليس صورة! 🚫 يرجى رفع ملفات صور فقط.');
            return;
        }

        const reader = new FileReader();

        // تحديث شريط التحميل أثناء القراءة
        reader.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentLoaded = Math.round((event.loaded / event.total) * 100);
                progressBar.style.width = percentLoaded + '%';
            }
        };

        reader.onloadstart = () => {
            progressContainer.style.display = 'block';
            progressBar.style.width = '0%';
        };

        reader.onload = (event) => {
            // فتح نافذة القص بدلاً من الرفع المباشر
            currentFileName = file.name;
            imageToCrop.src = event.target.result;
            cropModal.style.display = 'flex';
            
            // إعادة تعيين الفلتر
            currentFilter = 'none';
            filterBtns.forEach(btn => btn.classList.remove('active'));
            filterBtns[0].classList.add('active');
            imageToCrop.style.filter = 'none';

            if (cropper) {
                cropper.destroy();
            }
            cropper = new Cropper(imageToCrop, {
                viewMode: 1,
                autoCropArea: 1,
            });
        };
        reader.readAsDataURL(file);
    };

    // --- التعامل مع الفلاتر ---
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // تحديث الأزرار النشطة
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // تحديث المتغير وتطبيق الفلتر على المعاينة
            currentFilter = btn.getAttribute('data-filter');
            
            // تطبيق الفلتر على عناصر Cropper.js للمعاينة
            const cropperImages = document.querySelectorAll('.cropper-container img');
            cropperImages.forEach(img => img.style.filter = currentFilter);
        });
    });

    // --- أزرار نافذة القص ---
    confirmCropBtn.addEventListener('click', () => {
        if (cropper) {
            const canvas = cropper.getCroppedCanvas();
            
            // تطبيق الفلتر على الصورة النهائية إذا تم اختياره
            if (currentFilter !== 'none') {
                const filterCanvas = document.createElement('canvas');
                filterCanvas.width = canvas.width;
                filterCanvas.height = canvas.height;
                const ctx = filterCanvas.getContext('2d');
                
                // تطبيق الفلتر
                ctx.filter = currentFilter;
                ctx.drawImage(canvas, 0, 0);
                
                const croppedDataUrl = filterCanvas.toDataURL();
                finalizeUpload(croppedDataUrl, currentFileName);
            } else {
                const croppedDataUrl = canvas.toDataURL();
                finalizeUpload(croppedDataUrl, currentFileName);
            }
            
            cropModal.style.display = 'none';
        }
    });

    cancelCropBtn.addEventListener('click', () => {
        cropModal.style.display = 'none';
        progressContainer.style.display = 'none'; // إخفاء شريط التحميل عند الإلغاء
    });

    // --- تحميل الصور المحفوظة عند البدء ---
    // كود إصلاح: التحقق مما إذا كانت الصور المحفوظة هي الصور القديمة (mimo.app) ومسحها لعرض الصور الجديدة
    const rawData = localStorage.getItem('myGallery');
    if (rawData && rawData.includes('mimo.app')) {
        localStorage.removeItem('myGallery');
    }

    const savedImages = JSON.parse(localStorage.getItem('myGallery') || '[]');
    if (savedImages.length > 0) {
        list.innerHTML = ''; // مسح الصور الافتراضية إذا وجدنا صوراً محفوظة
        savedImages.forEach(item => {
            // دعم التوافقية: إذا كانت البيانات القديمة مجرد روابط نصية
            if (typeof item === 'string') {
                list.appendChild(createGalleryItem(item, 'صورة محفوظة', new Date().toLocaleString('ar-EG')));
            } else {
                // البيانات الجديدة عبارة عن كائنات
                list.appendChild(createGalleryItem(item.src, item.caption, item.date || new Date().toLocaleString('ar-EG'), item.likes || 0));
            }
        });
    } else {
        // إذا لم تكن هناك صور محفوظة، نقوم بحفظ الصور الافتراضية الموجودة في HTML
        // ونضيف لها أزرار الحذف
        document.querySelectorAll('.gallery li').forEach(li => {
            const img = li.querySelector('img');
            
            // إنشاء غلاف للصورة والأزرار
            const imageWrapper = document.createElement('div');
            imageWrapper.className = 'image-wrapper';
            
            // نقل الصورة داخل الغلاف
            li.insertBefore(imageWrapper, img);
            imageWrapper.appendChild(img);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'actions-container';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '&times;';

            const likeBtn = document.createElement('button');
            likeBtn.className = 'like-btn';
            likeBtn.innerHTML = '❤️ <span class="like-count">0</span>';

            const shareBtn = document.createElement('button');
            shareBtn.className = 'share-btn';
            shareBtn.innerHTML = '&#10150;';

            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-btn';
            downloadBtn.innerHTML = '&#11015;';

            const printBtn = document.createElement('button');
            printBtn.className = 'print-btn';
            printBtn.innerHTML = '&#128424;';

            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.innerHTML = '✏️';

            const fbBtn = document.createElement('button');
            fbBtn.className = 'fb-btn';
            fbBtn.innerHTML = 'f';

            const twitterBtn = document.createElement('button');
            twitterBtn.className = 'twitter-btn';
            twitterBtn.innerHTML = '𝕏';

            actionsDiv.appendChild(likeBtn);
            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(shareBtn);
            actionsDiv.appendChild(fbBtn);
            actionsDiv.appendChild(twitterBtn);
            actionsDiv.appendChild(downloadBtn);
            actionsDiv.appendChild(printBtn);
            actionsDiv.appendChild(deleteBtn);

            imageWrapper.appendChild(actionsDiv);

            const dateElem = document.createElement('div');
            dateElem.className = 'date-time';
            dateElem.textContent = new Date().toLocaleString('ar-EG');
            li.appendChild(dateElem);
        });
        saveImages(); // حفظ الحالة الأولية
    }

    // --- كود الوضع الليلي ---
    // التحقق من الوضع المحفوظ
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.body.classList.add('dark-mode');
        darkModeBtn.textContent = '☀️'; // تغيير الأيقونة للشمس
    }

    darkModeBtn.addEventListener('click', () => {
        playSound();
        document.body.classList.toggle('dark-mode');
        
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('darkMode', 'enabled');
            darkModeBtn.textContent = '☀️';
        } else {
            localStorage.setItem('darkMode', 'disabled');
            darkModeBtn.textContent = '🌙';
        }
    });

    // التحقق من حالة القفل المحفوظة عند تحميل الصفحة
    if (localStorage.getItem('isLocked') === 'true') {
        list.classList.add('locked');
        lockBtn.textContent = '🔓';
        lockBtn.title = 'فتح المعرض';
        button.disabled = true;
        uploadBtn.disabled = true;
        captionInput.disabled = true;
    }

    // --- كود تفعيل الإشعارات ---
    notifyBtn.addEventListener('click', () => {
        playSound();
        if (!("Notification" in window)) {
            alert("هذا المتصفح لا يدعم الإشعارات 🚫");
        } else if (Notification.permission === "granted") {
            new Notification("الإشعارات مفعلة بالفعل! ✅");
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    new Notification("تم تفعيل الإشعارات بنجاح! 🎉");
                }
            });
        }
    });

    // --- كود نافذة معلومات السفر ---
    infoBtn.addEventListener('click', () => {
        playSound();
        infoModal.style.display = 'flex';
    });

    closeInfo.addEventListener('click', () => {
        infoModal.style.display = 'none';
    });

    infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) {
            infoModal.style.display = 'none';
        }
    });

    // --- كود تشغيل النطق الصوتي للعبارات ---
    document.querySelectorAll('.speak-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const text = e.target.closest('.speak-btn').getAttribute('data-text');
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'id-ID'; // اللغة الإندونيسية
            utterance.rate = 0.9; // سرعة أبطأ قليلاً للوضوح
            window.speechSynthesis.speak(utterance);
        });
    });

    // --- كود مشاركة رابط التطبيق ---
    shareAppBtn.addEventListener('click', () => {
        playSound();
        const shareData = {
            title: document.title,
            text: 'اكتشف معرض الصور الآمن! 🛡️ احفظ صورك بخصوصية تامة.',
            url: window.location.href
        };

        if (navigator.share) {
            navigator.share(shareData)
                .then(() => console.log('تمت المشاركة بنجاح'))
                .catch((err) => console.error('فشل المشاركة', err));
        } else {
            navigator.clipboard.writeText(window.location.href)
                .then(() => alert('تم نسخ رابط الموقع للحافظة! 📋\nيمكنك إرساله لأصدقائك.'))
                .catch(() => prompt('انسخ الرابط يدوياً:', window.location.href));
        }
    });

    // --- كود تصدير الصور (ZIP Export) ---
    exportBtn.addEventListener('click', async () => {
        playSound();
        // التحقق من وجود مكتبة JSZip
        if (typeof JSZip === 'undefined') {
            alert('مكتبة الضغط غير محملة! تأكد من الاتصال بالإنترنت.');
            return;
        }

        const images = document.querySelectorAll('.gallery img');
        if (images.length === 0) {
            alert('لا توجد صور لتصديرها! 🤷‍♂️');
            return;
        }

        const originalText = exportBtn.textContent;
        exportBtn.textContent = '⏳'; // أيقونة انتظار
        exportBtn.disabled = true;

        try {
            const zip = new JSZip();
            const folder = zip.folder("my-gallery");

            // تحويل NodeList إلى مصفوفة للتعامل مع الوعود (Promises)
            const promises = Array.from(images).map(async (img, index) => {
                const src = img.src;
                let filename = `image-${index + 1}`;

                if (src.startsWith('data:')) {
                    // التعامل مع صور Base64 (المرفوعة محلياً)
                    const extension = src.split(';')[0].split('/')[1];
                    const data = src.split(',')[1];
                    folder.file(`${filename}.${extension}`, data, {base64: true});
                } else {
                    // التعامل مع روابط الصور (مثل صور الكلاب أو الثابتة)
                    const response = await fetch(src);
                    const blob = await response.blob();
                    folder.file(`${filename}.jpg`, blob);
                }
            });

            await Promise.all(promises);
            const content = await zip.generateAsync({type: "blob"});
            
            // إنشاء رابط تحميل مؤقت
            const url = window.URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gallery-backup-${new Date().toISOString().slice(0,10)}.zip`;
            a.click();
            window.URL.revokeObjectURL(url);
            
        } catch (err) {
            console.error(err);
            alert('حدث خطأ أثناء إنشاء الملف المضغوط.');
        } finally {
            exportBtn.textContent = originalText;
            exportBtn.disabled = false;
        }
    });

    // --- كود قفل المعرض (Security Lock) ---
    lockBtn.addEventListener('click', async () => {
        playSound();
        
        if (list.classList.contains('locked')) {
            // محاولة الفتح: طلب كلمة المرور
            const password = prompt('أدخل كلمة المرور لفتح المعرض: 🔑');
            if (password === null) return; // إلغاء

            const hashedPassword = await hashPassword(password); // تشفير المدخل للمقارنة
            const savedPassword = localStorage.getItem('galleryPassword');
            
            if (hashedPassword === savedPassword) {
                list.classList.remove('locked');
                lockBtn.textContent = '🔒';
                lockBtn.title = 'قفل المعرض';
                button.disabled = false;
                uploadBtn.disabled = false;
                captionInput.disabled = false;
                
                localStorage.removeItem('isLocked');
                localStorage.removeItem('galleryPassword'); // حذف كلمة المرور للسماح بتعيين جديدة لاحقاً
                alert('تم فتح المعرض بنجاح! 🔓');
            } else {
                alert('كلمة المرور خاطئة! 🚫');
            }
        } else {
            // محاولة القفل: تعيين كلمة مرور جديدة
            const password = prompt('قم بتعيين كلمة مرور لقفل المعرض: 🛡️');
            
            if (password && password.trim() !== '') {
                const hashedPassword = await hashPassword(password); // تشفير كلمة المرور قبل الحفظ
                localStorage.setItem('galleryPassword', hashedPassword);
                localStorage.setItem('isLocked', 'true');
                
                list.classList.add('locked');
                lockBtn.textContent = '🔓';
                lockBtn.title = 'فتح المعرض';
                button.disabled = true;
                uploadBtn.disabled = true;
                captionInput.disabled = true;
            }
        }
    });

    button.addEventListener('click', async () => {
        playSound();
        // 1. تغيير حالة الزر لإخبار المستخدم أن التحميل جارٍ
        const originalText = button.textContent;
        button.textContent = 'جاري التحميل... ⏳';
        button.disabled = true; // تعطيل الزر لمنع التكرار السريع

        // استخدام القائمة من ملف الإعدادات
        const indonesiaImages = window.siteConfig ? window.siteConfig.randomImages : [];

        try {
            // اختيار صورة عشوائية من القائمة
            const randomDest = indonesiaImages[Math.floor(Math.random() * indonesiaImages.length)];
            
            // محاكاة طلب شبكة (لتحويل الرابط إلى Blob إذا أردت حفظه محلياً لاحقاً، أو استخدامه مباشرة)
            const imageUrl = randomDest.url;

            // 3. إنشاء وإضافة الصورة كما في السابق
            const listItem = createGalleryItem(imageUrl, randomDest.caption, new Date().toLocaleString('ar-EG'), 0, true);
            list.appendChild(listItem);
            
            // حفظ التغييرات
            saveImages();

            // إرسال إشعار عند إضافة صورة جديدة
            sendNotification('اكتشف روعة إندونيسيا! ✈️', `هل تخطط لزيارة ${randomDest.caption} قريباً؟`);

            listItem.scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            console.error('حدث خطأ:', error);
            alert('تعذر جلب الصورة. تأكد من اتصالك بالإنترنت.');
        } finally {
            // 4. إعادة الزر لحالته الطبيعية سواء نجح الطلب أو فشل
            button.textContent = originalText;
            button.disabled = false;
        }
    });

    // --- كود رفع الصور من الجهاز ---
    uploadBtn.addEventListener('click', () => {
        playSound();
        fileInput.click(); // محاكاة النقر على input المخفي
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) processFile(file);
        
        // إعادة تعيين الحقل للسماح باختيار نفس الملف مجدداً إذا لزم الأمر
        fileInput.value = '';
        captionInput.value = ''; // مسح حقل النص بعد الإضافة
    });

    // --- كود السحب والإفلات (Drag and Drop) ---
    
    // منع السلوك الافتراضي للمتصفح (فتح الصورة بدلاً من رفعها)
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        container.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    // تفعيل تأثير التمييز عند السحب
    ['dragenter', 'dragover'].forEach(eventName => {
        container.addEventListener(eventName, () => container.classList.add('drag-active'), false);
    });

    // إزالة التأثير عند المغادرة أو الإفلات
    ['dragleave', 'drop'].forEach(eventName => {
        container.addEventListener(eventName, () => container.classList.remove('drag-active'), false);
    });

    // معالجة الملفات عند الإفلات
    container.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        // التعامل مع الملفات المرفوعة
        ([...files]).forEach(processFile);
        
        captionInput.value = ''; // مسح النص بعد الإفلات
    });

    // --- كود Lightbox ---
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.close');
    const slideshowBtn = document.getElementById('slideshowBtn');
    let slideshowInterval = null;

    // التعامل مع النقر على القائمة (سواء للصورة أو لزر الحذف)
    list.addEventListener('click', (e) => {
        // تشغيل الصوت عند النقر على أي زر داخل القائمة
        if (e.target.closest('button')) {
            playSound();
        }

        // إذا ضغطنا على الصورة -> فتح Lightbox
        if (e.target.tagName === 'IMG' || e.target.classList.contains('actions-container')) {
            lightbox.style.display = 'flex';
            // تحديد الصورة سواء تم النقر عليها مباشرة أو على الغلاف الشفاف
            const img = e.target.tagName === 'IMG' ? e.target : e.target.parentElement.querySelector('img');
            lightboxImg.src = img.src;
            document.body.style.overflow = 'hidden'; // منع التمرير في الخلفية
        }
        // إذا ضغطنا على زر الحذف
        else if (e.target.closest('.delete-btn')) {
            e.target.closest('.delete-btn').parentElement.remove(); // حذف العنصر من الصفحة
            saveImages(); // تحديث الذاكرة
        }
        // إذا ضغطنا على زر الإعجاب
        else if (e.target.closest('.like-btn')) {
            const btn = e.target.closest('.like-btn');
            const countSpan = btn.querySelector('.like-count');
            let count = parseInt(countSpan.textContent);
            count++;
            countSpan.textContent = count;
            saveImages();
            
            // تأثير بسيط عند النقر
            btn.style.transform = 'scale(1.2)';
            setTimeout(() => btn.style.transform = 'scale(1)', 200);
        }
        // إذا ضغطنا على زر المشاركة
        else if (e.target.closest('.share-btn')) {
            const li = e.target.closest('.share-btn').parentElement;
            const img = li.querySelector('img');
            const caption = li.querySelector('.caption').textContent;
            
            let text = `شاهد هذه الصورة: ${caption}`;
            // إضافة الرابط فقط إذا لم يكن Base64 (لأنه سيكون طويلاً جداً ولا يقبله واتساب)
            if (!img.src.startsWith('data:')) {
                text += `\n${img.src}`;
            }
            
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.open(whatsappUrl, '_blank');
        }
        // إذا ضغطنا على زر التحميل
        else if (e.target.closest('.download-btn')) {
            const li = e.target.closest('.download-btn').parentElement;
            const img = li.querySelector('img');
            const imageUrl = img.src;

            // دالة لتحميل الصورة كملف
            const downloadImage = async (url) => {
                try {
                    const response = await fetch(url);
                    const blob = await response.blob(); // تحويل الرابط إلى ملف ثنائي
                    const blobUrl = window.URL.createObjectURL(blob);
                    
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = `image-${Date.now()}.jpg`; // اسم افتراضي للملف
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(blobUrl);
                } catch (err) {
                    console.error('فشل التحميل المباشر، جاري الفتح في تبويب جديد', err);
                    window.open(url, '_blank');
                }
            };
            
            downloadImage(imageUrl);
        }
        // إذا ضغطنا على زر الطباعة
        else if (e.target.closest('.print-btn')) {
            const li = e.target.closest('.print-btn').parentElement;
            const img = li.querySelector('img');
            
            const printWindow = window.open('', '', 'height=600,width=800');
            printWindow.document.write('<html><head><title>طباعة الصورة</title>');
            printWindow.document.write('</head><body style="text-align:center; margin:0; display:flex; justify-content:center; align-items:center; height:100vh;">');
            printWindow.document.write('<img src="' + img.src + '" style="max-width:100%; max-height:100%;" onload="window.print();window.close()" />');
            printWindow.document.write('</body></html>');
            printWindow.document.close();
        }
        // إذا ضغطنا على زر التعديل
        else if (e.target.closest('.edit-btn')) {
            const li = e.target.closest('.edit-btn').parentElement;
            const captionDiv = li.querySelector('.caption');
            const oldText = captionDiv.textContent;
            const newText = prompt('تعديل وصف الصورة:', oldText);
            
            if (newText !== null && newText.trim() !== '') {
                captionDiv.textContent = newText;
                saveImages(); // حفظ التعديل في الذاكرة
            }
        }
        // إذا ضغطنا على زر فيسبوك
        else if (e.target.closest('.fb-btn')) {
            const li = e.target.closest('.fb-btn').parentElement;
            const img = li.querySelector('img');
            // إذا كانت الصورة من الإنترنت نشارك رابطها، وإلا نشارك رابط الموقع
            const urlToShare = !img.src.startsWith('data:') ? img.src : window.location.href;
            const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlToShare)}`;
            window.open(fbUrl, '_blank');
        }
        // إذا ضغطنا على زر تويتر
        else if (e.target.closest('.twitter-btn')) {
            const li = e.target.closest('.twitter-btn').parentElement;
            const img = li.querySelector('img');
            const caption = li.querySelector('.caption').textContent;
            const urlToShare = !img.src.startsWith('data:') ? img.src : window.location.href;
            const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(urlToShare)}`;
            window.open(twitterUrl, '_blank');
        }
        // إذا ضغطنا على زر LinkedIn
        else if (e.target.closest('.linkedin-btn')) {
            const li = e.target.closest('.linkedin-btn').parentElement;
            const img = li.querySelector('img');
            // LinkedIn يشارك الروابط فقط
            const urlToShare = !img.src.startsWith('data:') ? img.src : window.location.href;
            const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(urlToShare)}`;
            window.open(linkedinUrl, '_blank');
        }
        // إذا ضغطنا على زر Telegram
        else if (e.target.closest('.telegram-btn')) {
            const li = e.target.closest('.telegram-btn').parentElement;
            const img = li.querySelector('img');
            const caption = li.querySelector('.caption').textContent;
            const urlToShare = !img.src.startsWith('data:') ? img.src : window.location.href;
            const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(urlToShare)}&text=${encodeURIComponent(caption)}`;
            window.open(telegramUrl, '_blank');
        }
        // إذا ضغطنا على زر النسخ
        else if (e.target.closest('.copy-btn')) {
            const li = e.target.closest('.copy-btn').parentElement;
            const img = li.querySelector('img');
            const urlToShare = !img.src.startsWith('data:') ? img.src : window.location.href;
            
            navigator.clipboard.writeText(urlToShare).then(() => {
                alert('تم نسخ رابط الصورة! 📋');
            }).catch(() => {
                prompt('انسخ الرابط يدوياً:', urlToShare);
            });
            playSound();
        }
    });

    // --- كود عرض الشرائح (Slideshow) ---
    const stopSlideshow = () => {
        if (slideshowInterval) {
            clearInterval(slideshowInterval);
            slideshowInterval = null;
            slideshowBtn.innerHTML = '▶';
            slideshowBtn.style.paddingLeft = '4px';
        }
    };

    slideshowBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // منع إغلاق النافذة
        if (slideshowInterval) {
            stopSlideshow();
        } else {
            slideshowBtn.innerHTML = '⏸';
            slideshowBtn.style.paddingLeft = '0';
            
            // دالة الانتقال للصورة التالية
            const showNext = () => {
                const images = Array.from(document.querySelectorAll('.gallery img'));
                const currentSrc = lightboxImg.src;
                let currentIndex = images.findIndex(img => img.src === currentSrc);
                let nextIndex = (currentIndex + 1) % images.length;
                
                lightboxImg.style.opacity = '0';
                setTimeout(() => {
                    lightboxImg.src = images[nextIndex].src;
                    lightboxImg.style.opacity = '1';
                }, 200);
            };
            
            showNext(); // انتقال فوري
            slideshowInterval = setInterval(showNext, 3000); // ثم كل 3 ثواني
        }
    });

    // إغلاق النافذة عند الضغط على زر الإغلاق
    closeBtn.addEventListener('click', () => {
        playSound();
        stopSlideshow(); // إيقاف العرض عند الإغلاق
        lightbox.style.display = 'none';
        document.body.style.overflow = 'auto'; // إعادة التمرير
        lightboxImg.classList.remove('zoomed'); // إلغاء التكبير
    });

    // إغلاق النافذة عند الضغط خارج الصورة
    lightbox.addEventListener('click', (e) => {
        if (e.target !== lightboxImg && e.target !== slideshowBtn) {
            stopSlideshow(); // إيقاف العرض عند الإغلاق
            lightbox.style.display = 'none';
            document.body.style.overflow = 'auto';
            lightboxImg.classList.remove('zoomed');
        }
    });

    // تكبير/تصغير الصورة عند النقر عليها
    lightboxImg.addEventListener('click', (e) => {
        e.stopPropagation(); // منع إغلاق النافذة عند النقر على الصورة
        lightboxImg.classList.toggle('zoomed');
    });

    // --- تأثير التموج (Ripple Effect) ---
    document.addEventListener('click', function (e) {
        const button = e.target.closest('button');
        if (button) {
            const circle = document.createElement('span');
            const diameter = Math.max(button.clientWidth, button.clientHeight);
            const radius = diameter / 2;
            const rect = button.getBoundingClientRect();

            circle.style.width = circle.style.height = `${diameter}px`;
            circle.style.left = `${e.clientX - rect.left - radius}px`;
            circle.style.top = `${e.clientY - rect.top - radius}px`;
            circle.classList.add('ripple');

            const ripple = button.getElementsByClassName('ripple')[0];
            if (ripple) {
                ripple.remove();
            }

            button.appendChild(circle);
            
            setTimeout(() => circle.remove(), 600);
        }
    });

    // --- تحميل الأخبار من ملف JSON ---
    const loadNewsTicker = async () => {
        const tickerContent = document.querySelector('.ticker-content');
        if (!tickerContent) return;

        // استخدام الأخبار من ملف الإعدادات مباشرة
        if (window.siteConfig && window.siteConfig.newsTicker) {
            tickerContent.innerHTML = '';
            window.siteConfig.newsTicker.forEach(item => {
                const span = document.createElement('span');
                span.textContent = item;
                tickerContent.appendChild(span);
            });
        } else {
            tickerContent.innerHTML = '<span>مرحباً بك في إندونيسيا! 🇮🇩</span>';
        }
    };
    loadNewsTicker();

    // --- تحديث الأخبار والمحتوى تلقائياً كل دقيقة ---
    setInterval(() => {
        // التحقق مما إذا كانت الصفحة نشطة (Visible) قبل التحديث لتوفير البيانات
        if (document.hidden) return;

        const script = document.createElement('script');
        script.src = `config.js?t=${Date.now()}`; // إضافة توقيت لتجاوز الذاكرة المؤقتة (Cache)
        script.onload = () => {
            if (window.siteConfig) {
                // 1. تحديث شريط الأخبار
                loadNewsTicker();

                // 2. تحديث النصوص الرئيسية
                if (document.getElementById('headerTitle')) document.getElementById('headerTitle').textContent = window.siteConfig.general.title;
                if (document.getElementById('headerSubtitle')) document.getElementById('headerSubtitle').textContent = window.siteConfig.general.subtitle;

                // 3. تحديث الخبر المميز (الجريدة)
                if (document.getElementById('newsBannerImage')) document.getElementById('newsBannerImage').src = window.siteConfig.featuredNews.image;
                if (document.getElementById('newsBannerTag')) document.getElementById('newsBannerTag').textContent = window.siteConfig.featuredNews.tag;
                if (document.getElementById('newsBannerTitle')) document.getElementById('newsBannerTitle').textContent = window.siteConfig.featuredNews.title;
                if (document.getElementById('newsBannerSummary')) document.getElementById('newsBannerSummary').textContent = window.siteConfig.featuredNews.summary;

                // 4. تحديث تاريخ آخر تعديل
                const currentLang = document.documentElement.lang || 'ar';
                if (document.getElementById('lastUpdateDisplay') && window.siteConfig.general.lastUpdated && translations) {
                    document.getElementById('lastUpdateDisplay').textContent = translations[currentLang].lastUpdate + window.siteConfig.general.lastUpdated;
                }
            }
        };
        document.body.appendChild(script);
    }, 30000); // 30000 ميلي ثانية = 30 ثانية

    // --- إخفاء شاشة التحميل عند اكتمال تحميل الصفحة ---
    const loaderWrapper = document.getElementById('loader-wrapper');
    const pageProgressBar = document.getElementById('pageProgressBar');
    const loadingText = document.getElementById('loadingText');

    if (loaderWrapper) {
        // محاكاة التقدم حتى 90%
        let width = 0;
        const interval = setInterval(() => {
            if (width >= 90) {
                clearInterval(interval);
            } else {
                width += Math.random() * 15; // زيادة عشوائية
                if (width > 90) width = 90;
                if (pageProgressBar) pageProgressBar.style.width = width + '%';
                if (loadingText) loadingText.textContent = Math.round(width) + '%';
            }
        }, 200);

        window.addEventListener('load', () => {
            clearInterval(interval);
            if (pageProgressBar) pageProgressBar.style.width = '100%';
            if (loadingText) loadingText.textContent = '100%';

            // 1. إخفاء الشعار والمؤشر أولاً بتأثير تلاشي
            const logo = document.querySelector('.loader-logo');
            const progressContainer = document.querySelector('.page-progress-container');
            if (logo) logo.style.opacity = '0';
            if (progressContainer) progressContainer.style.opacity = '0';
            if (loadingText) loadingText.style.opacity = '0';

            // 2. إخفاء الخلفية البيضاء بعد اختفاء الشعار (0.5 ثانية)
            setTimeout(() => {
                loaderWrapper.style.opacity = '0';
                loaderWrapper.style.visibility = 'hidden';

                // رسالة ترحيبية تظهر لمرة واحدة فقط
                if (!localStorage.getItem('visitedBefore')) {
                    setTimeout(() => {
                        alert('مرحباً بك في "Wonderful Indonesia"! 🇮🇩✨\n\nاستعد لاستكشاف أكثر من 17,000 جزيرة من الجمال الطبيعي.\nهنا يمكنك اكتشاف وجهات جديدة، وحفظ ذكريات رحلتك.\n\nنتمنى لك تجربة لا تُنسى! 🌺');
                        localStorage.setItem('visitedBefore', 'true');
                    }, 500);
                }
            }, 500); 
        });
    }

    // --- تسجيل Service Worker (PWA) ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('تم تسجيل التطبيق بنجاح 📱'))
            .catch((err) => console.error('فشل تسجيل التطبيق', err));
    }

    // --- نموذج النشرة البريدية ---
    document.querySelectorAll('.newsletter-form form').forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault(); // منع الإرسال الفعلي للصفحة
            const emailInput = form.querySelector('.newsletter-input');
            if (emailInput && emailInput.value) {
                playSound();
                alert(`شكراً لاشتراكك! 🎉\nسيتم إرسال آخر الأخبار إلى: ${emailInput.value}`);
                emailInput.value = ''; // تفريغ الحقل
            }
        });
    });

    // --- محول العملات (Currency Converter) ---
    const usdInput = document.getElementById('usdInput');
    const idrInput = document.getElementById('idrInput');
    const exchangeRate = 15500; // سعر صرف تقريبي

    if (usdInput && idrInput) {
        usdInput.addEventListener('input', () => {
            const usd = parseFloat(usdInput.value);
            if (!isNaN(usd)) {
                // تنسيق الرقم مع فواصل الآلاف
                idrInput.value = (usd * exchangeRate).toLocaleString('en-US');
            } else {
                idrInput.value = '';
            }
        });
    }

    // --- زر العودة للأعلى ---
    const backToTopBtn = document.getElementById('backToTop');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('show');
        } else {
            backToTopBtn.classList.remove('show');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // --- عداد الزوار (محلي) ---
    let visits = localStorage.getItem('visitCount');
    if (!visits) {
        visits = 0;
    }
    visits = parseInt(visits) + 1;
    localStorage.setItem('visitCount', visits);
    
    const visitDisplay = document.getElementById('visitCountDisplay');
    if (visitDisplay) {
        visitDisplay.textContent = `👀 عدد زياراتك: ${visits}`;
    }

    // --- تعدد اللغات (Multi-language Support) ---
    const translations = {
        ar: {
            title: "اكتشف جمال إندونيسيا 🇮🇩",
            subtitle: "بوابتك الأولى لاستكشاف سحر الطبيعة، الثقافة، والمغامرة في جوهرة الشرق",
            addBtn: "إضافة وجهة سياحية 🏝️",
            uploadBtn: "شارك تجربتك 📸",
            clearBtn: "حذف جميع الصور",
            exportBtn: "تصدير كملف ZIP",
            lockBtn: "الوضع الخاص",
            darkModeBtn: "الوضع الليلي",
            notifyBtn: "تفعيل الإشعارات",
            infoBtn: "معلومات السفر",
            shareAppBtn: "مشاركة رابط الموقع",
            galleryTitle: "📸 معرض السياحة",
            newsTitle: "📰 آخر الأخبار",
            eduTitle: "🎓 التعليم والمنح الدراسية",
            eduDesc: "فرصة لا تعوض للدراسة في أفضل الجامعات الإندونيسية مع تغطية شاملة للمصاريف.",
            eduBtn: "تفاصيل المنحة والتقديم 📝",
            footerText: "🌴 دليل السياحة في إندونيسيا | © 2026",
            aboutLink: "من نحن",
            privacyLink: "سياسة الخصوصية",
            newsletterTitle: "📬 اشترك في نشرتنا البريدية",
            newsletterDesc: "احصل على آخر أخبار السياحة والمنح مباشرة في بريدك.",
            subscribeBtn: "اشتراك",
            visitLabel: "👀 عدد زياراتك: ",
            whatsappBtn: "تواصل معنا عبر واتساب",
            lastUpdate: "🕒 آخر تحديث: "
        },
        en: {
            title: "Discover Wonderful Indonesia 🇮🇩",
            subtitle: "Your gateway to explore nature, culture, and adventure in the Jewel of the East",
            addBtn: "Add Destination 🏝️",
            uploadBtn: "Share Experience 📸",
            clearBtn: "Delete All",
            exportBtn: "Export ZIP",
            lockBtn: "Private Mode",
            darkModeBtn: "Dark Mode",
            notifyBtn: "Enable Notifications",
            infoBtn: "Travel Info",
            shareAppBtn: "Share App",
            galleryTitle: "📸 Tourism Gallery",
            newsTitle: "📰 Latest News",
            eduTitle: "🎓 Education & Scholarships",
            eduDesc: "A unique opportunity to study at top Indonesian universities with full coverage.",
            eduBtn: "Scholarship Details 📝",
            footerText: "🌴 Indonesia Tourism Guide | © 2026",
            aboutLink: "About Us",
            privacyLink: "Privacy Policy",
            newsletterTitle: "📬 Subscribe to Newsletter",
            newsletterDesc: "Get the latest tourism and scholarship news directly to your inbox.",
            subscribeBtn: "Subscribe",
            visitLabel: "👀 Your Visits: ",
            whatsappBtn: "Chat with us on WhatsApp",
            lastUpdate: "🕒 Last Updated: "
        },
        id: {
            title: "Jelajahi Pesona Indonesia 🇮🇩",
            subtitle: "Gerbang Anda untuk menjelajahi alam, budaya, dan petualangan di Permata Timur",
            addBtn: "Tambah Destinasi 🏝️",
            uploadBtn: "Bagikan Pengalaman 📸",
            clearBtn: "Hapus Semua",
            exportBtn: "Ekspor ZIP",
            lockBtn: "Mode Pribadi",
            darkModeBtn: "Mode Gelap",
            notifyBtn: "Aktifkan Notifikasi",
            infoBtn: "Info Perjalanan",
            shareAppBtn: "Bagikan Aplikasi",
            galleryTitle: "📸 Galeri Pariwisata",
            newsTitle: "📰 Berita Terbaru",
            eduTitle: "🎓 Pendidikan & Beasiswa",
            eduDesc: "Kesempatan unik untuk belajar di universitas terbaik Indonesia dengan cakupan penuh.",
            eduBtn: "Detail Beasiswa 📝",
            footerText: "🌴 Panduan Wisata Indonesia | © 2026",
            aboutLink: "Tentang Kami",
            privacyLink: "Kebijakan Privasi",
            newsletterTitle: "📬 Berlangganan Buletin",
            newsletterDesc: "Dapatkan berita pariwisata dan beasiswa terbaru langsung di kotak masuk Anda.",
            subscribeBtn: "Langganan",
            visitLabel: "👀 Kunjungan Anda: ",
            whatsappBtn: "Chat dengan kami di WhatsApp",
            lastUpdate: "🕒 Terakhir Diperbarui: "
        }
    };

    langSelect.addEventListener('change', (e) => {
        const lang = e.target.value;
        const t = translations[lang];
        
        // تغيير اتجاه الصفحة
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;

        // تحديث النصوص
        document.querySelector('header h1').textContent = t.title;
        document.querySelector('header p').textContent = t.subtitle;
        
        // تحديث الأزرار الرئيسية
        document.getElementById('addBtn').textContent = t.addBtn;
        document.getElementById('uploadBtn').textContent = t.uploadBtn;
        
        // تحديث عناوين أزرار الأدوات (Tooltips)
        document.getElementById('clearBtn').title = t.clearBtn;
        document.getElementById('exportBtn').title = t.exportBtn;
        document.getElementById('lockBtn').title = t.lockBtn;
        document.getElementById('darkModeBtn').title = t.darkModeBtn;
        document.getElementById('notifyBtn').title = t.notifyBtn;
        document.getElementById('infoBtn').title = t.infoBtn;
        document.getElementById('shareAppBtn').title = t.shareAppBtn;

        // تحديث عناوين الأقسام
        const sectionTitles = document.querySelectorAll('.section-title');
        if (sectionTitles[0]) sectionTitles[0].textContent = t.galleryTitle;
        if (sectionTitles[1]) sectionTitles[1].textContent = t.newsTitle;
        if (sectionTitles[2]) sectionTitles[2].textContent = t.eduTitle;

        // تحديث قسم التعليم
        document.querySelector('.education-section p').textContent = t.eduDesc;
        document.querySelector('.edu-btn').textContent = t.eduBtn;

        // تحديث التذييل والنشرة البريدية
        document.querySelector('.footer p').textContent = t.footerText;
        
        const aboutLink = document.getElementById('aboutLink');
        if (aboutLink) aboutLink.textContent = t.aboutLink;
        const privacyLink = document.getElementById('privacyLink');
        if (privacyLink) privacyLink.textContent = t.privacyLink;
        
        document.querySelector('.newsletter-form h4').textContent = t.newsletterTitle;
        document.querySelector('.newsletter-form p').textContent = t.newsletterDesc;
        document.querySelector('.newsletter-btn').textContent = t.subscribeBtn;

        if (visitDisplay) {
            visitDisplay.textContent = t.visitLabel + localStorage.getItem('visitCount');
        }

        const whatsappFloat = document.getElementById('whatsappFloat');
        if (whatsappFloat) whatsappFloat.title = t.whatsappBtn;

        if (document.getElementById('lastUpdateDisplay') && window.siteConfig && window.siteConfig.general.lastUpdated) {
            document.getElementById('lastUpdateDisplay').textContent = t.lastUpdate + window.siteConfig.general.lastUpdated;
        }
    });
});