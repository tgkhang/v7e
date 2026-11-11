Mpm prefork - multi processing module
Là module quyết định how apache handle requests đồng thời
Prefork là 1 trong các MPM của apache
Các cái khác vd : worker, event, cả 2 đều áp dụng mô hình đa luồng, nhưng event có thêm xử lý bất đồng bộ cho các kết nối nhàn rỗi
Apache có thể chuyển đổi qua lại giữa các MPM, nhưng tại 1 thời điểm chỉ đc phép tải 1 NPM
MPM đc tải dưới dạng module nên chỉ cần sửa tệp cấu hình, khởi động là có thể chuyển đổi ko cần biên dịch lại

Kiến trúc Apache (mô hình prefork)
Apache (với MPM prefork)  dùng mô hình pre-forking, ko dùng thread: 
1 tiến trình cha quản lý, sinh ra nhiều process con
Mỗi tiến trình con xử lý một request tại 1 thời điểm
Apache luôn duy trì sẵn 1 số tiến trình free để đón request mới, tránh việc client phải chờ tiến trình được fork ra
Hệ quả:
Số request đồng thời bị giới hạn bởi MaxClients (số tiến trình con tối đa). Nếu vượt quá, request có thể bị từ chối/ đợi.
Mỗi tiến trình chiếm RAM nhất định ( vài MB đến vài chục MB tùy module). Khi số kết nối tăng cao, Apache tốn nhiều tài nguyên để duy trì và chuyển đổi context giữa các tiến trình

Lưu ý: "prefork" không phải mô hình duy nhất của Apache mà là mặc định. 
Apache còn có MPM worker (dùng thread) và event
Mô hình Worker: đa tiến trình đa luồng
Worker khởi tạo nhiều tiến trình con nhưng mỗi tiến trình con tạo ra nhiều luồng thread, và mỗi thread chịu trách nhiệm xử lý 1 kết nối
So với prefork nó xử lý nhiều yêu cầu đồng thời hơn với ít bộ nhớ hơn, do các luồng chia sẻ ko gian bộ nhớ của tiến trình
Nhược điểm: đối với các kết nối keep alive nhàn rỗi, luồng vẫn bị chiếm giữ, gây ra lãng phí tài nguyên
Mô hình Event MPM: mô hình đa luồng đc tối ưu hóa
Event dựa trên worker nhưng giải quyết vấn đề kết nối nhàn rỗi
Nó thêm 1 hoặc nhiều listener thread giám sát, chuyên xử lý các kết nối keep alive nhàn rỗi. Khi 1 kết nooisi thực sự có yêu cầu đến

