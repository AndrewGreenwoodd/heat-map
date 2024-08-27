import React, { useState } from "react";

const UploadForm: React.FC = () => {
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mapFile && zipFile) {
      const formData = new FormData();
      formData.append("map", mapFile);
      formData.append("zip", zipFile);

      const response = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
      });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const img = document.getElementById("result-img") as HTMLImageElement;
      img.src = url;
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="file"
        accept=".jpg,.jpeg"
        onChange={(e) => setMapFile(e.target.files?.[0] || null)}
      />
      <input
        type="file"
        accept=".zip"
        onChange={(e) => setZipFile(e.target.files?.[0] || null)}
      />
      <button type="submit">Upload</button>
      <img id="result-img" alt="Sea Surface Temperature Map" />
    </form>
  );
};

export default UploadForm;
