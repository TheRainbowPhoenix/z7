#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <windows.h>
#include <iphlpapi.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct pcap pcap_t;
typedef struct pcap_if { struct pcap_if *next; char *name, *description; void *addresses; unsigned flags; } pcap_if_t;
typedef struct { long seconds, microseconds; uint32_t caplen, len; } packet_header;
typedef struct {
    int (*find)(pcap_if_t **, char *);
    void (*free_devices)(pcap_if_t *);
    pcap_t *(*open)(const char *, int, int, int, char *);
    int (*next)(pcap_t *, packet_header **, const unsigned char **);
    int (*send)(pcap_t *, const unsigned char *, int);
    int (*datalink)(pcap_t *);
    const char *(*error)(pcap_t *);
    void (*close)(pcap_t *);
} Pcap;
typedef struct { uint8_t mac[6], ip[12]; const char *name, *description; int priority_tag; } Identity;
typedef struct { uint8_t bytes[1024]; size_t length; int failed; } Buffer;
static volatile LONG stopping;
static BOOL WINAPI stop(DWORD signal) { if (signal == CTRL_C_EVENT || signal == CTRL_BREAK_EVENT) { InterlockedExchange(&stopping, 1); return TRUE; } return FALSE; }
static unsigned be16(const uint8_t *p) { return (unsigned)p[0] * 256 + p[1]; }
static void put(Buffer *b, const void *data, size_t n) {
    if (n > sizeof(b->bytes) - b->length) { b->failed = 1; return; }
    memcpy(b->bytes + b->length, data, n); b->length += n;
}
static void word(Buffer *b, unsigned value) { uint8_t p[2] = {(uint8_t)(value >> 8), (uint8_t)value}; put(b, p, 2); }
static void block(Buffer *b, unsigned option, unsigned sub, unsigned info, const void *data, size_t n) {
    uint8_t head[2] = {(uint8_t)option, (uint8_t)sub};
    put(b, head, 2); word(b, (unsigned)n + 2); word(b, info); put(b, data, n);
    if (n & 1) { uint8_t zero = 0; put(b, &zero, 1); }
}
static int ipv4(const char *text, uint8_t *output) {
    unsigned a, b, c, d; char tail;
    if (sscanf(text, "%u.%u.%u.%u%c", &a, &b, &c, &d, &tail) != 4 || a > 255 || b > 255 || c > 255 || d > 255) return 0;
    output[0] = (uint8_t)a; output[1] = (uint8_t)b; output[2] = (uint8_t)c; output[3] = (uint8_t)d; return 1;
}
static int mac_address(const char *text, uint8_t *output) {
    unsigned v[6]; char tail;
    if (sscanf(text,"%2x:%2x:%2x:%2x:%2x:%2x%c",&v[0],&v[1],&v[2],&v[3],&v[4],&v[5],&tail)!=6 || (v[0]&1)) return 0;
    unsigned any=0;
    for (size_t i=0;i<6;++i) { output[i]=(uint8_t)v[i];any|=v[i]; }
    return any!=0;
}
static int station(const char *text) {
    size_t n = strlen(text), label = 0;
    if (!n || n > 240) return 0;
    for (size_t i = 0; i < n; ++i) {
        unsigned char c = (unsigned char)text[i];
        if (c == '.') { if (!label || text[i-1] == '-') return 0; label = 0; continue; }
        if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || (c == '-' && label))) return 0;
        if (++label > 63) return 0;
    }
    return label && text[n-1] != '-';
}
static int filters(const uint8_t *data, size_t n, const Identity *id) {
    while (n) {
        if (n < 4) return 0;
        unsigned option = data[0], sub = data[1], size = be16(data + 2);
        size_t total = 4 + size + (size & 1);
        if (total > n) return 0;
        if (option == 255 && sub == 255) { if (size != 0) return 0; }
        else if (option == 2 && sub == 2) { if (size != strlen(id->name) || memcmp(data + 4, id->name, size)) return 0; }
        else if (option == 1 && sub == 1) { if (size != 6 || memcmp(data + 4, id->mac, 6)) return 0; }
        else return 0;
        data += total; n -= total;
    }
    return 1;
}
static size_t reply(const Identity *id, const uint8_t *packet, size_t n, Buffer *out) {
    memset(out, 0, sizeof(*out));
    if (n < 14) return 0;
    unsigned type = be16(packet + 12); size_t offset = 14;
    if (type == 0x8100) { if (n < 18) return 0; type = be16(packet + 16); offset = 18; }
    if (type != 0x8892 || n - offset < 12) return 0;
    const uint8_t *d = packet + offset; size_t payload = be16(d + 10);
    if (payload > n - offset - 12 || d[3] != 0) return 0;
    int identify = be16(d) == 0xfefe && d[2] == 5;
    int flash = be16(d) == 0xfefd && d[2] == 4;
    static const uint8_t multicast[6] = {1,14,207,0,0,0}, broadcast[6] = {255,255,255,255,255,255};
    if (memcmp(packet, id->mac, 6) && (!identify || (memcmp(packet, multicast, 6) && memcmp(packet, broadcast, 6)))) return 0;
    if (identify) { if (!filters(d + 12, payload, id)) return 0; }
    else if (flash) {
        if (payload != 8 || d[12] != 5 || d[13] != 3 || be16(d + 14) != 4) return 0;
    } else return 0;
    put(out, packet + 6, 6); put(out, id->mac, 6);
    if (offset==14 && id->priority_tag) { word(out,0x8100);word(out,0);word(out,0x8892); }
    else put(out, packet + 12, offset - 12);
    word(out, identify ? 0xfeff : 0xfefd);
    uint8_t service[2] = {d[2], 1}; put(out, service, 2); put(out, d + 4, 4); word(out, 0);
    size_t length_offset = out->length; word(out, 0); size_t start = out->length;
    if (identify) {
        static const uint8_t options[] = {2,7}, device[] = {0,42,1,14}, role[] = {0,0}, instance[] = {0,100};
        block(out, 2, 5, 0, options, sizeof(options));
        block(out, 2, 1, 0, id->description, strlen(id->description));
        block(out, 2, 2, 0, id->name, strlen(id->name));
        block(out, 2, 3, 0, device, sizeof(device)); block(out, 2, 4, 0, role, sizeof(role));
        block(out, 2, 7, 0, instance, sizeof(instance)); block(out, 1, 2, 1, id->ip, sizeof(id->ip));
    } else {
        const uint8_t ack[] = {5,4,0,3,5,3,0,0}; put(out, ack, sizeof(ack));
    }
    size_t length = out->length - start;
    out->bytes[length_offset] = (uint8_t)(length >> 8); out->bytes[length_offset+1] = (uint8_t)length;
    while (out->length < 60) { uint8_t zero = 0; put(out, &zero, 1); }
    return out->failed ? 0 : out->length;
}
static int self_test(void) {
    Identity id = {{2,1,2,3,4,5}, {192,168,0,100,255,255,255,0,0,0,0,0}, "zomsp-plc", "S7-1500 (zDCP)",0};
    uint8_t p[64] = {1,14,207,0,0,0, 2,9,8,7,6,5, 0x88,0x92, 0xfe,0xfe,5,0,1,2,3,4,0,0,0,4,255,255,0,0};
    Buffer out; size_t size = reply(&id, p, 30, &out);
    if (size < 60 || memcmp(out.bytes, p+6, 6) || be16(out.bytes+14) != 0xfeff || memcmp(out.bytes+18,p+18,4) || be16(out.bytes+24) != size-26) return 1;
    for (size_t n = 0; n < 30; ++n) if (reply(&id,p,n,&out)) return 2;
    p[29] = 1; if (reply(&id,p,30,&out)) return 3; p[29] = 0;
    memcpy(p+6,id.mac,6);
    if (!reply(&id,p,30,&out)) return 6;
    id.priority_tag=1;
    if (!reply(&id,p,30,&out) || be16(out.bytes+12)!=0x8100 || be16(out.bytes+14)!=0 || be16(out.bytes+18)!=0xfeff) return 7;
    id.priority_tag=0;
    uint8_t vlan[68]; memcpy(vlan,p,12); vlan[12]=0x81;vlan[13]=0;vlan[14]=0;vlan[15]=7;memcpy(vlan+16,p+12,18);
    if (!reply(&id,vlan,34,&out) || be16(out.bytes+14)!=7 || be16(out.bytes+18)!=0xfeff) return 4;
    memcpy(p,id.mac,6);p[14]=0xfe;p[15]=0xfd;p[16]=4;p[25]=8;
    memcpy(p+26,(uint8_t[]){5,3,0,4,0,0,0,1},8);
    if (!reply(&id,p,34,&out) || memcmp(out.bytes+26,(uint8_t[]){5,4,0,3,5,3,0,0},8)) return 5;
    puts("zDCP self-test: Identify, same-adapter scanner, VLAN/priority tag, Flash, truncation and malformed filters passed"); return 0;
}
static int load(Pcap *api) {
    char path[MAX_PATH]; UINT n = GetSystemDirectoryA(path, MAX_PATH);
    if (!n || n + 18 >= MAX_PATH) return 0;
    strcat(path,"\\Npcap\\wpcap.dll"); HMODULE dll = LoadLibraryExA(path,NULL,LOAD_WITH_ALTERED_SEARCH_PATH);
    if (!dll) { path[n] = 0; strcat(path,"\\wpcap.dll"); dll=LoadLibraryExA(path,NULL,LOAD_WITH_ALTERED_SEARCH_PATH); }
    if (!dll) return 0;
#define LOAD(field, name) do { *(FARPROC *)&api->field=GetProcAddress(dll,name); if (!api->field) return 0; } while(0)
    LOAD(find,"pcap_findalldevs"); LOAD(free_devices,"pcap_freealldevs"); LOAD(open,"pcap_open_live");
    LOAD(next,"pcap_next_ex"); LOAD(send,"pcap_sendpacket"); LOAD(datalink,"pcap_datalink"); LOAD(error,"pcap_geterr"); LOAD(close,"pcap_close");
#undef LOAD
    return 1;
}
static int adapter_mac(const char *device, uint8_t mac[6]) {
    ULONG size=0; if (GetAdaptersInfo(NULL,&size)!=ERROR_BUFFER_OVERFLOW || size > 1024*1024) return 0;
    IP_ADAPTER_INFO *all=malloc(size); if (!all) return 0; int found=0;
    if (GetAdaptersInfo(all,&size)==NO_ERROR) for (IP_ADAPTER_INFO *a=all;a;a=a->Next) {
        if (a->AddressLength==6 && strstr(device,a->AdapterName)) { memcpy(mac,a->Address,6);found=1;break; }
    }
    free(all);return found;
}
int main(int argc, char **argv) {
    if (argc==2 && !strcmp(argv[1],"--self-test")) return self_test();
    const char *iface=NULL,*ip=NULL; int list=0,custom_mac=0,verbose=0;
    Identity id={{0},{0,0,0,0,255,255,255,0,0,0,0,0},"zomsp-plc","S7-1500 (zDCP)",0};
    for (int i=1;i<argc;++i) {
        if (!strcmp(argv[i],"--list")) { list=1;continue; }
        if (!strcmp(argv[i],"--vlan0")) { id.priority_tag=1;continue; }
        if (!strcmp(argv[i],"--verbose")) { verbose=1;continue; }
        if (i+1>=argc) goto usage;
        const char *option=argv[i++],*value=argv[i];
        if (!strcmp(option,"--interface")) iface=value;
        else if (!strcmp(option,"--ip")) ip=value;
        else if (!strcmp(option,"--name")) id.name=value;
        else if (!strcmp(option,"--description")) id.description=value;
        else if (!strcmp(option,"--mac")) { if (!mac_address(value,id.mac)) goto usage;custom_mac=1; }
        else if (!strcmp(option,"--mask")) { if (!ipv4(value,id.ip+4)) goto usage; }
        else if (!strcmp(option,"--gateway")) { if (!ipv4(value,id.ip+8)) goto usage; }
        else goto usage;
    }
    if (!list && (!iface || !ip || !ipv4(ip,id.ip) || !station(id.name) || strlen(id.description)>240)) goto usage;
    Pcap api; if (!load(&api)) { fputs("Npcap is required. Install Npcap, then run from an elevated terminal.\n",stderr); return 1; }
    char error[256]={0};pcap_if_t *devices=NULL;
    if (api.find(&devices,error)) { fprintf(stderr,"Npcap: %s\n",error);return 1; }
    int index=0,chosen=0;char device[1024]={0};
    for (pcap_if_t *d=devices;d;d=d->next) {
        ++index; if (list) printf("%d  %s\n   %s\n",index,d->name,d->description?d->description:"");
        char number[16];snprintf(number,sizeof(number),"%d",index);
        if (iface && (!strcmp(iface,number)||!strcmp(iface,d->name)) && strlen(d->name)<sizeof(device)) { strcpy(device,d->name);chosen=1; }
    }
    api.free_devices(devices);if(list)return 0;
    if (!chosen || (!custom_mac && !adapter_mac(device,id.mac))) { fputs("Select an Ethernet interface from --list (adapter MAC required).\n",stderr);return 1; }
    pcap_t *pcap=api.open(device,2048,1,500,error);
    if (!pcap) { fprintf(stderr,"Npcap open: %s\n",error);return 1; }
    if (api.datalink(pcap)!=1) { fputs("Only Ethernet interfaces are supported.\n",stderr);api.close(pcap);return 1; }
    SetConsoleCtrlHandler(stop,TRUE);
    printf("zDCP: %s at %s, MAC %02x:%02x:%02x:%02x:%02x:%02x\nInterface: %s\nListening for DCP Identify/Flash. Ctrl+C stops.\nTCP/102 must be served separately by zOMSp or z7; IP must belong to this adapter.\n",id.name,ip,id.mac[0],id.mac[1],id.mac[2],id.mac[3],id.mac[4],id.mac[5],device);fflush(stdout);
    while (!stopping) {
        packet_header *header;const unsigned char *packet;int result=api.next(pcap,&header,&packet);
        if (!result) continue;
        if (result<0) { fprintf(stderr,"Npcap receive: %s\n",api.error(pcap));api.close(pcap);return 1; }
        if (verbose && header->caplen>=26) {
            size_t off=be16(packet+12)==0x8100?18:14;
            if (header->caplen>=off+12 && be16(packet+off-2)==0x8892) {
                printf("DCP RX %02x:%02x:%02x:%02x:%02x:%02x frame=%04x service=%u/%u xid=%02x%02x%02x%02x payload=",packet[6],packet[7],packet[8],packet[9],packet[10],packet[11],be16(packet+off),packet[off+2],packet[off+3],packet[off+4],packet[off+5],packet[off+6],packet[off+7]);
                for(size_t j=off+12;j<header->caplen && j<off+76;++j) printf("%02x",packet[j]);
                putchar('\n');fflush(stdout);
            }
        }
        Buffer response;size_t size=reply(&id,packet,header->caplen,&response);
        if (size && api.send(pcap,response.bytes,(int)size)) fprintf(stderr,"Npcap send: %s\n",api.error(pcap));
        else if(size) { puts("DCP reply sent");fflush(stdout); }
    }
    api.close(pcap);return 0;
usage:
    fputs("zDCP --list\nzDCP --interface NUMBER_OR_NPF_PATH --ip ADAPTER_IP [--name zomsp-plc] [--mask 255.255.255.0] [--gateway 0.0.0.0] [--description TEXT] [--mac 02:c0:a8:00:64:01] [--vlan0] [--verbose]\nzDCP --self-test\n",stderr);return 2;
}
