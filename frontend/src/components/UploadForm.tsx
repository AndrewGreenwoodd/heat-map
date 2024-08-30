import React, { useState } from 'react';
import styles from './UploadForm.module.css';

const UploadForm: React.FC = () => {
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mapFile && zipFile) {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('map', mapFile);
      formData.append('zip', zipFile);

      try {
        const response = await fetch('http://localhost:5000/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to upload files');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setMapUrl(url);
      } catch (error) {
        setError((error as Error).message);
      } finally {
        setLoading(false);
      }
    } else {
      setError('Please select both files before uploading.');
    }
  };

  return (
    <div>
      {mapUrl ? (
        <img
          src={mapUrl}
          alt="Sea Surface Temperature Map"
          className={styles.mapImage}
        />
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <label>Your empty map file:</label>
          <input
            type="file"
            accept=".jpg,.jpeg"
            onChange={(e) => setMapFile(e.target.files?.[0] || null)}
            className={styles.input}
          />
          <label>Binary map file:</label>
          <input
            type="file"
            accept=".zip"
            onChange={(e) => setZipFile(e.target.files?.[0] || null)}
            className={styles.input}
          />
          <button type="submit" className={styles.formBtn}>
            Upload
          </button>
          {loading && (
            <div>
              {' '}
              <p>Generating image</p>
              <div className={styles.spinner}></div>
            </div>
          )}{' '}
        </form>
      )}
      {error && <div className={styles.error}>{error}</div>}{' '}
    </div>
  );
};

export default UploadForm;
