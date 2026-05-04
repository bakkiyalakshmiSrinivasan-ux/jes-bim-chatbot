'use strict';
const xlsxHandler = require('./_pa-xlsx-template');
const pdfHandler = require('./_pa-pdf-template');

module.exports = (req, res) => {
  if (req.query.type === 'pdf') return pdfHandler(req, res);
  return xlsxHandler(req, res);
};
