#include <iostream>
using namespace std;
int main()
{
    int n,rem,dig=0;

    cout<<"Enter  Digit =";
    cin>>n;
    while(n!=0)
    {
        rem=(n%10);
        dig= dig*10+rem;
        n/=10;
    }
    cout<<endl<<"reverse number = "<<dig;
}
