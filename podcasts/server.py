# server.py
import os
import json
import datetime
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename

STATIC_FOLDER = os.getcwd()
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

app = Flask(__name__, static_folder=STATIC_FOLDER)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/save-json', methods=['POST'])
def save_json():
    data = request.get_json()
    if not data or 'filename' not in data or 'content' not in data:
        return jsonify({'status': 'error', 'message': 'Invalid data received.'}), 400

    safe_filename = os.path.basename(data['filename'])
    if safe_filename != data['filename'] or not safe_filename.endswith('.json'):
        return jsonify({'status': 'error', 'message': 'Invalid filename.'}), 400

    file_path = os.path.join(STATIC_FOLDER, 'json', safe_filename)

    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data['content'], f, ensure_ascii=False, indent=2)
        print(f"Successfully saved {safe_filename}")
        return jsonify({'status': 'success', 'message': f'File {safe_filename} saved successfully.'})
    except Exception as e:
        print(f"Error saving {safe_filename}: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# --- UPDATED ENDPOINT FOR IMAGE UPLOADS ---
@app.route('/upload-image', methods=['POST'])
def upload_image():
    # 1. Validate the request
    if 'image_file' not in request.files:
        return jsonify({'status': 'error', 'message': 'No image file part in the request.'}), 400
    
    file = request.files['image_file']
    presentation_id = request.form.get('presentation_id')
    target_filename_from_client = request.form.get('target_filename')

    if file.filename == '' or not presentation_id or not target_filename_from_client:
        return jsonify({'status': 'error', 'message': 'Missing data (file, id, or filename).'}), 400

    if not allowed_file(file.filename):
        return jsonify({'status': 'error', 'message': 'File type not allowed.'}), 400

    # 2. Sanitize inputs and define paths
    safe_id = secure_filename(presentation_id)
    # Use werkzeug's secure_filename for the target file as a security best practice
    target_filename = secure_filename(target_filename_from_client)
    
    image_dir = os.path.join(STATIC_FOLDER, 'images', safe_id)
    archive_dir = os.path.join(image_dir, 'archive')
    
    os.makedirs(image_dir, exist_ok=True)
    os.makedirs(archive_dir, exist_ok=True)

    target_path = os.path.join(image_dir, target_filename)

    # 3. Archive the old image if it exists
    if os.path.exists(target_path):
        try:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            # Archive name: my_image_20231027_153000.png
            base, ext = os.path.splitext(target_filename)
            archive_filename = f"{base}_{timestamp}{ext}"
            archive_path = os.path.join(archive_dir, archive_filename)
            os.rename(target_path, archive_path)
            print(f"Archived existing image to {archive_path}")
        except Exception as e:
            print(f"Could not archive file: {e}")
            return jsonify({'status': 'error', 'message': f'Could not archive existing file: {e}'}), 500

    # 4. Save the new image
    try:
        file.save(target_path)
        print(f"Saved new image to {target_path}")
        return jsonify({'status': 'success', 'message': f'Image {target_filename} updated.'})
    except Exception as e:
        print(f"Could not save new file: {e}")
        return jsonify({'status': 'error', 'message': f'Could not save new file: {e}'}), 500


@app.route('/')
def root():
    return send_from_directory(STATIC_FOLDER, 'editor.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(STATIC_FOLDER, path)

if __name__ == '__main__':
    print("Starting Flask server...")
    print(f"Open your browser and go to: http://127.0.0.1:5000")
    app.run(debug=True, port=5000)