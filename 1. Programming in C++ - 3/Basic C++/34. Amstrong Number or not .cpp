//153, 371, 407, 370
#include <iostream>
using namespace std;
int main()
{
  int n,rem,sum=0,x;
 cout << "*** Enter a number for checking - it is Amstrong Number or Not ... ***"<<endl ;
 cout<<"Input Number = " ;
 cin>> n;
 x=n;
 while(n!=0)
 {
     rem=n%10;
     sum=sum+rem*rem*rem;
     n/=10;
 }
 if(x==sum)
 {
     cout<<"** "<<x<< "  is  a  Amstrong  Number...***";
 }
 else
 {
        cout<<"** "<<x<< "  is  a  not  Amstrong  Number...***";
 }
}
