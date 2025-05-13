import express from 'express';
import { isAdmin } from '../middleware/authMiddleware.js';
import authMiddleware from '../middleware/authMiddleware.js';
import {
    reportPost,
    reportUser,
    reportComment,
    getReports,
    updateReportStatus,
    deleteReport
} from '../controllers/reportCTL.js';

const routerReport = express.Router();

// Routes cho người dùng
routerReport.post('/post', authMiddleware, reportPost);
routerReport.post('/user', authMiddleware, reportUser);
routerReport.post('/comment', authMiddleware, reportComment);

// Routes cho admin
routerReport.get('/admin', authMiddleware, isAdmin, getReports);
routerReport.put('/admin/status', authMiddleware, isAdmin, updateReportStatus);
routerReport.delete('/admin', authMiddleware, isAdmin, deleteReport);

export default routerReport;
