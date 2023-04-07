#include <iostream>

using namespace std;

int main() {

   int N, hour ,mini;
   cin>>N;
   hour = N/3600;
   N=N-(hour*3600);

   mini = N/60;
   N=N-( mini * 60);

   cout<<hour<<":"<<mini<<":"<<N<<endl;
    return 0;
}
