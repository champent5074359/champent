# BusinessOS TODO

## Sprint 1 — Business OS Foundation

- [x] Create the project folder structure
- [x] Create the core architecture and product documentation
- [x] Define the initial database entities and relationships
- [x] Define the initial system flows and UX/UI direction
- [x] Define the development blueprint

## Sprint 2 — Data Foundation

- [x] Initialize the React + TypeScript frontend
- [x] Create the Supabase project and local configuration
- [x] Design the first PostgreSQL schema and migration
- [x] Design row-level security policies for the core organization tables
- [ ] Apply the reviewed migration to the Supabase project

## Sprint 4 — Authentication and Core Database

- [x] Connect login, signup, signout, session loading, and auth-state changes to Supabase Auth
- [x] Add protected routes and a workspace gate
- [x] Add first-time business and branch setup
- [x] Create the first core-database SQL migration with RLS policies
- [ ] Review and run the migration in Supabase SQL Editor
- [ ] Test signup, email confirmation, login, onboarding, signout, and RLS access against the target project

## Future Backlog

- [ ] Product, category, and inventory management
- [ ] Sales and point-of-sale workflow
- [ ] Income, expense, supplier, and purchase management
- [ ] Dashboard and reports
- [ ] Event and goal tracking
- [ ] Multi-branch analytics
- [ ] Testing, deployment, and monitoring

## Sprint 6A — Category Management Release Notes

- [x] เพิ่มหมวดหมู่สินค้าจากหน้า Products
- [x] แก้ไขชื่อ รายละเอียด ลำดับการแสดง และสถานะหมวดหมู่
- [x] เปิดหรือปิดใช้งานหมวดหมู่
- [x] ลบหมวดหมู่แบบ Soft Delete พร้อมตรวจสอบสินค้าที่กำลังใช้งาน
- [x] ตรวจชื่อหมวดหมู่ซ้ำภายในธุรกิจปัจจุบัน
- [x] จำกัดการจัดการสำหรับ owner และ manager พร้อมโหมดอ่านอย่างเดียวสำหรับ staff

## Sprint 6B — Unit Management Release Notes

- [x] เพิ่มและแก้ไขชื่อ ตัวย่อ และสถานะหน่วยนับจากหน้า Products
- [x] ลบหน่วยนับแบบ Soft Delete พร้อมตรวจสอบสินค้าที่กำลังใช้งาน
- [x] ตรวจชื่อหน่วยนับซ้ำภายในธุรกิจปัจจุบัน
- [x] เพิ่มหน่วยพื้นฐาน 10 รายการโดยข้ามชื่อที่มีอยู่แล้ว
- [x] จำกัดการจัดการสำหรับ owner และ manager โดย staff ไม่เห็นปุ่มจัดการ
- [x] รองรับ Loading, Empty, Error และ Success State ภาษาไทยบนหน้าจอมือถือ

## Sprint 6C — Product Management Release Notes

- [x] เพิ่มและแก้ไขข้อมูลสินค้า พร้อมหมวดหมู่ หน่วยนับ ราคา และสถานะ
- [x] สร้างหมวดหมู่หรือหน่วยนับจากฟอร์มสินค้าและเลือกข้อมูลใหม่อัตโนมัติ
- [x] ตรวจ SKU และ Barcode ซ้ำ พร้อมบันทึกค่าว่างเป็น null
- [x] ค้นหาจากชื่อ SKU และ Barcode พร้อมกรองหมวดหมู่ สถานะ และการติดตามสต๊อก
- [x] เรียงสินค้าตามชื่อ สร้างล่าสุด และราคาขาย
- [x] ลบสินค้าแบบ Soft Delete และคง RLS/Audit เดิม
- [x] จำกัดการเพิ่ม แก้ไข และลบสำหรับ owner และ manager
- [x] รองรับ Loading, Empty, Error และ Success State ภาษาไทยบนมือถือ
